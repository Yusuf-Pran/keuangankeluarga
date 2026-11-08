/**
 * SakuGenius - server lisensi, pendaftaran akun, dan persetujuan lewat Telegram.
 *
 * Dipasang sebagai Web App (Deploy > New deployment > Web app):
 *   - Execute as: Me
 *   - Who has access: Anyone
 * Panduan lengkap: docs/PANDUAN-LOGIN-BARU.md
 *
 * Script Properties yang dibutuhkan (Project Settings > Script properties):
 *   FIREBASE_API_KEY         API key web Firebase (sama dengan di js/firebase-sync.js)
 *   FIREBASE_PROJECT_ID      sakugenius-app
 *   TELEGRAM_BOT_TOKEN       token dari @BotFather (RAHASIA, jangan dibagikan)
 *   TELEGRAM_CHAT_ID         chat id Telegram admin (penerima notifikasi)
 *   SHEET_ID                 (opsional) ID Google Sheet, jika script tidak menempel di Sheet
 *   SHEET_NAME               (opsional) nama tab, default "Lisensi"
 */

var HEADERS = {
  kode: 'Kode',
  status: 'Status',
  nama: 'Nama',
  email: 'Email',
  phone: 'No HP',
  uid: 'UID',
  akun: 'Status Akun',
  daftar: 'Tanggal Daftar',
  diputuskan: 'Tanggal Diputuskan',
};

// ===================== ENTRY POINT =====================

function doGet(e) {
  return json_({ ok: true, app: 'SakuGenius', message: 'Server lisensi aktif.' });
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, message: 'Permintaan tidak valid.' });
  }

  try {
    if (body.action === 'checkLicense') return json_(checkLicense_(body));
    if (body.action === 'register') return json_(register_(body));
    return json_({ ok: false, message: 'Aksi tidak dikenal.' });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, valid: false, message: 'Terjadi kesalahan di server. Coba lagi.' });
  }
}

// ===================== LISENSI & PENDAFTARAN =====================

function checkLicense_(body) {
  var kode = normCode_(body.kode);
  if (!kode) return { valid: false, message: 'Kode lisensi wajib diisi.' };
  var row = findRowByCode_(kode);
  if (!row) return { valid: false, message: 'Kode lisensi tidak ditemukan.' };
  if (row.get('uid')) return { valid: false, message: 'Kode lisensi ini sudah dipakai untuk akun lain.' };
  return { valid: true, message: 'Kode lisensi valid. Silakan buat akun.' };
}

function register_(body) {
  var kode = normCode_(body.kode);
  var nama = String(body.nama || '').trim().slice(0, 100);
  var phone = normPhone_(body.phone);
  if (!kode || !nama || !body.idToken) return { ok: false, message: 'Data pendaftaran tidak lengkap.' };
  if (!/^62\d{8,13}$/.test(phone)) return { ok: false, message: 'Nomor HP tidak valid.' };

  // Pastikan akun Firebase benar-benar milik pendaftar
  var user = verifyIdToken_(body.idToken);
  if (!user) return { ok: false, message: 'Sesi pendaftaran tidak valid. Coba lagi.' };
  var email = String(user.email || '').toLowerCase();

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var row = findRowByCode_(kode);
    if (!row) return { ok: false, message: 'Kode lisensi tidak ditemukan.' };
    if (row.get('uid')) return { ok: false, message: 'Kode lisensi ini sudah dipakai untuk akun lain.' };

    // Pengguna lama: kode sudah tercatat atas email tertentu, harus sama
    var emailTercatat = String(row.get('email') || '').trim().toLowerCase();
    if (emailTercatat && emailTercatat !== email) {
      return { ok: false, message: 'Kode lisensi ini terdaftar atas email lain. Gunakan email yang sama saat aktivasi pertama.' };
    }

    // No. HP harus unik
    var phoneOk = firestoreCreate_('phoneIndex/' + phone, { email: email, uid: user.localId });
    if (!phoneOk) return { ok: false, message: 'No. HP ini sudah terdaftar. Silakan masuk.' };

    try {
      firestoreSet_('members/' + user.localId, {
        nama: nama,
        email: email,
        phone: phone,
        licenseCode: kode,
        status: 'pending',
        createdAt: new Date(),
      });
    } catch (err) {
      firestoreDelete_('phoneIndex/' + phone);
      throw err;
    }

    var now = new Date();
    row.set({
      status: 'Dipakai',
      nama: nama,
      email: email,
      phone: "'" + phone,
      uid: user.localId,
      akun: 'Menunggu',
      daftar: now,
    });
  } finally {
    lock.releaseLock();
  }

  notifyAdmin_(user.localId, { kode: kode, nama: nama, email: email, phone: phone });
  return { ok: true, message: 'Pendaftaran terkirim. Menunggu persetujuan admin.' };
}

// ===================== TELEGRAM =====================

function notifyAdmin_(uid, d) {
  var text =
    '🆕 *Pendaftaran akun SakuGenius*\n\n' +
    'Nama: ' + esc_(d.nama) + '\n' +
    'Email: ' + esc_(d.email) + '\n' +
    'No HP: ' + esc_(d.phone) + '\n' +
    'Kode lisensi: `' + esc_(d.kode) + '`\n\n' +
    'Cocokkan dengan data pembelian, lalu pilih:';
  tg_('sendMessage', {
    chat_id: prop_('TELEGRAM_CHAT_ID'),
    text: text,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Setujui', callback_data: 'approve:' + uid },
        { text: '❌ Tolak', callback_data: 'reject:' + uid },
      ]],
    },
  });
}

function handleTelegram_(update) {
  var adminChat = String(prop_('TELEGRAM_CHAT_ID') || '');

  // Bantuan awal: kirim /start ke bot untuk mengetahui chat id
  if (update.message && update.message.text === '/start') {
    tg_('sendMessage', {
      chat_id: update.message.chat.id,
      text: 'Chat ID Anda: ' + update.message.chat.id + '\nMasukkan angka ini ke Script Property TELEGRAM_CHAT_ID.',
    });
    return;
  }

  var cb = update.callback_query;
  if (!cb || !cb.message) return;
  if (String(cb.message.chat.id) !== adminChat) {
    tg_('answerCallbackQuery', { callback_query_id: cb.id, text: 'Tidak diizinkan.' });
    return;
  }

  var parts = String(cb.data || '').split(':');
  var action = parts[0];
  var uid = parts[1];
  if (!uid || (action !== 'approve' && action !== 'reject')) return;

  var status = action === 'approve' ? 'approved' : 'rejected';
  firestoreUpdate_('members/' + uid, { status: status, decidedAt: new Date() });

  var row = findRowByUid_(uid);
  if (row) row.set({ akun: status === 'approved' ? 'Disetujui' : 'Ditolak', diputuskan: new Date() });

  var label = status === 'approved' ? '✅ DISETUJUI' : '❌ DITOLAK';
  tg_('answerCallbackQuery', { callback_query_id: cb.id, text: label });
  tg_('editMessageText', {
    chat_id: cb.message.chat.id,
    message_id: cb.message.message_id,
    text: cb.message.text + '\n\n' + label + ' oleh ' + (cb.from.first_name || 'admin'),
  });
}

/**
 * Mengambil tombol yang ditekan admin di Telegram (dijalankan otomatis tiap 1 menit).
 * Memakai getUpdates, bukan webhook, karena Web App Apps Script membalas dengan
 * redirect 302 yang membuat Telegram mengirim ulang update terus-menerus.
 */
function pollTelegram() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    var props = PropertiesService.getScriptProperties();
    var offset = Number(props.getProperty('TELEGRAM_OFFSET') || 0);
    var res = tg_('getUpdates', { offset: offset, timeout: 0, allowed_updates: ['message', 'callback_query'] });
    (res.result || []).forEach(function (update) {
      try {
        handleTelegram_(update);
      } catch (err) {
        console.error(err);
      }
      props.setProperty('TELEGRAM_OFFSET', String(update.update_id + 1));
    });
  } finally {
    lock.releaseLock();
  }
}

/** Jalankan SEKALI dari editor: memasang pemicu pollTelegram tiap 1 menit. */
function setupTelegramPolling() {
  tg_('deleteWebhook', {});
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'pollTelegram') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('pollTelegram').timeBased().everyMinutes(1).create();
  Logger.log('Pemicu pollTelegram terpasang. Kirim /start ke bot untuk melihat Chat ID.');
}

/** Opsional: kirim pesan uji ke admin untuk memastikan bot tersambung. */
function testTelegram() {
  Logger.log(JSON.stringify(tg_('sendMessage', { chat_id: prop_('TELEGRAM_CHAT_ID'), text: 'Bot SakuGenius tersambung ✅' })));
}

function tg_(method, payload) {
  var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + prop_('TELEGRAM_BOT_TOKEN') + '/' + method, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  return JSON.parse(res.getContentText() || '{}');
}

function esc_(s) {
  return String(s || '').replace(/([_*`\[])/g, '\\$1');
}

// ===================== FIREBASE =====================

function verifyIdToken_(idToken) {
  var res = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + prop_('FIREBASE_API_KEY'),
    { method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) return null;
  var users = JSON.parse(res.getContentText()).users || [];
  return users[0] || null;
}

function fsUrl_(path) {
  return 'https://firestore.googleapis.com/v1/projects/' + prop_('FIREBASE_PROJECT_ID') +
    '/databases/(default)/documents/' + path;
}

function fsFetch_(url, method, fields) {
  return UrlFetchApp.fetch(url, {
    method: method,
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({ fields: toFields_(fields) }),
    muteHttpExceptions: true,
  });
}

/** Buat dokumen baru; false jika dokumen sudah ada. */
function firestoreCreate_(path, data) {
  var res = fsFetch_(fsUrl_(path) + '?currentDocument.exists=false', 'patch', data);
  if (res.getResponseCode() === 200) return true;
  if (/FAILED_PRECONDITION|ALREADY_EXISTS/.test(res.getContentText())) return false;
  throw new Error('Firestore create gagal: ' + res.getContentText());
}

function firestoreSet_(path, data) {
  var res = fsFetch_(fsUrl_(path), 'patch', data);
  if (res.getResponseCode() !== 200) throw new Error('Firestore set gagal: ' + res.getContentText());
}

function firestoreUpdate_(path, data) {
  var mask = Object.keys(data).map(function (k) { return 'updateMask.fieldPaths=' + k; }).join('&');
  var res = fsFetch_(fsUrl_(path) + '?currentDocument.exists=true&' + mask, 'patch', data);
  if (res.getResponseCode() !== 200) throw new Error('Firestore update gagal: ' + res.getContentText());
}

function firestoreDelete_(path) {
  UrlFetchApp.fetch(fsUrl_(path), {
    method: 'delete',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  });
}

function toFields_(obj) {
  var out = {};
  Object.keys(obj).forEach(function (k) {
    var v = obj[k];
    if (v instanceof Date) out[k] = { timestampValue: v.toISOString() };
    else if (typeof v === 'number') out[k] = { doubleValue: v };
    else if (typeof v === 'boolean') out[k] = { booleanValue: v };
    else out[k] = { stringValue: String(v) };
  });
  return out;
}

// ===================== GOOGLE SHEET =====================

function sheet_() {
  var id = prop_('SHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(prop_('SHEET_NAME') || 'Lisensi');
  if (!sh) throw new Error('Tab sheet "Lisensi" tidak ditemukan.');
  return sh;
}

/** Peta nama kolom -> nomor kolom; kolom yang belum ada ditambahkan di kanan. */
function columns_(sh) {
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  var map = {};
  Object.keys(HEADERS).forEach(function (key) {
    var idx = header.indexOf(HEADERS[key]);
    if (idx === -1) {
      header.push(HEADERS[key]);
      idx = header.length - 1;
      sh.getRange(1, idx + 1).setValue(HEADERS[key]);
    }
    map[key] = idx + 1;
  });
  return map;
}

function findRow_(key, value) {
  var sh = sheet_();
  var cols = columns_(sh);
  var last = sh.getLastRow();
  if (last < 2) return null;
  var values = sh.getRange(2, cols[key], last - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    var cell = key === 'kode' ? normCode_(values[i][0]) : String(values[i][0]).trim();
    if (cell && cell === value) return rowObj_(sh, cols, i + 2);
  }
  return null;
}

function findRowByCode_(kode) { return findRow_('kode', kode); }
function findRowByUid_(uid) { return findRow_('uid', uid); }

function rowObj_(sh, cols, rowNum) {
  return {
    get: function (key) { return sh.getRange(rowNum, cols[key]).getValue(); },
    set: function (data) {
      Object.keys(data).forEach(function (key) { sh.getRange(rowNum, cols[key]).setValue(data[key]); });
    },
  };
}

// ===================== UTIL =====================

function normCode_(v) { return String(v || '').trim().toUpperCase(); }

function normPhone_(v) {
  var d = String(v || '').replace(/\D/g, '');
  if (d.indexOf('0') === 0) d = '62' + d.slice(1);
  else if (d.indexOf('8') === 0) d = '62' + d;
  return d;
}

function prop_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

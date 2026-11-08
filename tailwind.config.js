/** @type {import('tailwindcss').Config} */
// Palet SakuGenius: biru logo (#55A2D8) sebagai warna utama,
// abu-abu bernuansa biru navy, dan aksen emas untuk sentuhan elegan.
const brand = {
  50: "#F0F7FC",
  100: "#DDEDF8",
  200: "#BFDCF1",
  300: "#93C5E7",
  400: "#55A2D8", // warna logo
  500: "#3A8BC8",
  600: "#2B72AE",
  700: "#245C8D",
  800: "#224D74",
  900: "#1F4161",
  950: "#142A41",
};
const ink = {
  50: "#F5F8FB",
  100: "#EDF2F7",
  200: "#E1E8F0",
  300: "#CAD5E2",
  400: "#95A3B8",
  500: "#66768C",
  600: "#46546A",
  700: "#27374F",
  800: "#172539",
  900: "#0E1A2B",
  950: "#08111E",
};
module.exports = {
  content: ["./index.html", "./js/**/*.js"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: brand[600],
        primaryDark: brand[700],
        brand,
        indigo: brand,
        gray: ink,
        gold: { 100: "#F7EDD6", 300: "#E8CD8E", 400: "#DDB866", 500: "#C9A24A", 600: "#A88332" },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "Inter", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};

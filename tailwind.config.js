/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./js/**/*.js"],
  darkMode: "class",
  theme: {
    extend: {
      colors: { primary: "#4f46e5", primaryDark: "#4338ca" },
    },
  },
  plugins: [],
};

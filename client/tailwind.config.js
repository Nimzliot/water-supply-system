/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"]
      },
      colors: {
        brand: {
          50: "#eef7fb",
          100: "#d6ebf5",
          200: "#add7ea",
          300: "#7bbcd9",
          400: "#4a9cc3",
          500: "#2a7fa9",
          600: "#1c668c",
          700: "#175272",
          800: "#14435d",
          900: "#11374c"
        }
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.05)"
      }
    }
  },
  plugins: []
};

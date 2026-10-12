/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"]
      },
      colors: {
        // One strong brand red, used for primary actions and the active state only.
        brand: {
          50: "#fff1f2",
          100: "#ffe2e5",
          200: "#ffc9cf",
          300: "#fb9ca6",
          400: "#f46b79",
          500: "#ec4a5a",
          600: "#e23744",
          700: "#c22532",
          800: "#a0202c",
          900: "#851f29"
        },
        // Near-black for text and dark surfaces, softer than pure black.
        ink: {
          DEFAULT: "#1c1c1c",
          soft: "#2b2b2b"
        }
      },
      boxShadow: {
        card: "0 1px 2px rgba(28, 28, 28, 0.04), 0 6px 20px rgba(28, 28, 28, 0.06)",
        nav: "0 -1px 0 rgba(28, 28, 28, 0.06), 0 -8px 24px rgba(28, 28, 28, 0.06)"
      }
    }
  },
  plugins: []
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#07121f",
        mist: "#e6f0f7",
        aqua: "#3dd9b6",
        surge: "#0ea5e9",
        sand: "#f8e7be",
        alert: "#fb7185"
      },
      boxShadow: {
        panel: "0 18px 60px rgba(7, 18, 31, 0.24)"
      },
      backgroundImage: {
        mesh: "radial-gradient(circle at top left, rgba(61,217,182,0.18), transparent 32%), radial-gradient(circle at top right, rgba(14,165,233,0.16), transparent 28%), linear-gradient(180deg, #08111d 0%, #10253c 100%)"
      }
    }
  },
  plugins: []
};


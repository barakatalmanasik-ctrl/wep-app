/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#1a73e8",
          700: "#1565c0",
          800: "#1e56a0",
          900: "#1a4480",
        },
      },
      fontFamily: {
        sans: ["Segoe UI", "Cairo", "sans-serif"],
      },
    },
  },
  plugins: [],
};

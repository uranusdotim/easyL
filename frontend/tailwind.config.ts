import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef9ff",
          100: "#d9f1ff",
          200: "#bce8ff",
          300: "#8edaff",
          400: "#59c3ff",
          500: "#33a5ff",
          600: "#1b87f5",
          700: "#146fe1",
          800: "#1759b6",
          900: "#194c8f",
          950: "#142f57",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;

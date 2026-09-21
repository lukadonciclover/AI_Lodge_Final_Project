import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 950: "#07111f", 900: "#0b1729", 800: "#12233d", 700: "#193454" },
        ink: "#142033",
        line: "#dce3ec",
        accent: "#2474d2"
      },
      boxShadow: { card: "0 1px 2px rgba(7,17,31,.04), 0 8px 24px rgba(7,17,31,.05)" }
    }
  },
  plugins: []
};

export default config;

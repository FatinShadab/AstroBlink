import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,js,jsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // AstroBlink brand palette — deep space theme.
        astro: {
          bg: "#0a0e1a",
          surface: "#131829",
          accent: "#6366f1", // indigo-500
          highlight: "#f59e0b", // amber-500 for detected objects
          danger: "#ef4444", // red-500 for masked pixels
        },
      },
    },
  },
  plugins: [],
};

export default config;

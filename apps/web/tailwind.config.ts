import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-noto-tc)",
          "PingFang TC",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        // Brand accent — clinical-warm teal. Used sparingly: marks, focus,
        // section underlines. Primary CTA stays gray-900 for trust.
        brand: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          400: "#2dd4bf",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
        },
      },
    },
  },
  plugins: [],
};

export default config;

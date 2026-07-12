import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0E0D",
        panel: "#121815",
        "panel-border": "#223028",
        text: "#E7EEEA",
        muted: "#7C8C86",
        trace: "#5EEAA0",
        amber: "#F2B84B",
        teal: "#4FD1C5",
        danger: "#E5735A",
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "JetBrains Mono",
          "Menlo",
          "Consolas",
          "monospace",
        ],
        sans: ["-apple-system", "Segoe UI", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;

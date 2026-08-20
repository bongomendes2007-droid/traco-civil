import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand Colors from Manual v2.0
        traco: {
          laranja: "#FF5A1F",
          brasa: "#D9440F",
          fogo: "#B8360B",
          claro: "#FFC9A6",
          vidro: "#FFF0E6",
        },
        papel: {
          DEFAULT: "#FFFBF7",
          2: "#FFF3EA",
        },
        grafite: {
          DEFAULT: "#1C1815",
          2: "#4A433D",
          3: "#837A70",
        },
        linha: "#EAD9CB",
        ciano: "#1C4E80",
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
export default config;
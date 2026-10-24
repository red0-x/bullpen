/** @type {import('tailwindcss').Config} */
module.exports = {
  blocklist: ["overline"],
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FBF4EA",
        line: "#E8D9C6",
        cap: { DEFAULT: "#7B3F25", lip: "#5A2C18" },
        espresso: "#3A1F14",
        cocoa: "#7A5A48",
        blush: { DEFAULT: "#FBE3DA", ink: "#8A3418" },
        sage: { DEFAULT: "#E5EBD8", ink: "#3B4E22" },
      },
      fontFamily: {
        head: ["var(--font-head)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      borderRadius: { card: "20px", btn: "16px", field: "8px" },
      keyframes: {
        rise: { from: { opacity: "0", transform: "translateY(10px)" }, to: { opacity: "1", transform: "none" } },
        wag: { "0%,100%": { transform: "rotate(0deg)" }, "50%": { transform: "rotate(-6deg)" } },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
      },
      animation: { rise: "rise 0.45s ease-out both", wag: "wag 0.6s ease-in-out", marquee: "marquee 40s linear infinite" },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

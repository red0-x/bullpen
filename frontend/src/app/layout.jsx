import Script from "next/script";
import { Bricolage_Grotesque, Onest } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const head = Bricolage_Grotesque({ subsets: ["latin"], weight: ["800"], variable: "--font-head" });
const body = Onest({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body" });

export const metadata = {
  title: "Bullpup | Your contractor backup bench",
  description: "A ranked backup bench of contractors for every rental property and amenity.",
  icons: { icon: "/mascot/pup-head.webp" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${head.variable} ${body.variable}`}>
      <body>
        <Providers>{children}</Providers>
        <Script src="https://assets.emergent.sh/scripts/emergent-main.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}

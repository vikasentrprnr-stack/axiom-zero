import type { Metadata } from "next";
import { Outfit, Open_Sans } from "next/font/google";
import "./globals.css";

// === PRIMARY FONT: Outfit ===
const outfit = Outfit({ 
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-outfit', 
});

// === SECONDARY FONT: Open Sans ===
const openSans = Open_Sans({ 
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-open-sans', 
});

// === BRANDING UPDATE ===
export const metadata: Metadata = {
  title: "Axiom-Zero | Local-First AI Research Engine",
  description: "A highly intelligent, 100% local AI research engine powered by WebGPU.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* 
        1. Inject both font CSS variables into the body.
        2. Set 'font-open-sans' as the default global font.
        3. 'antialiased' makes text rendering sharper on MacOS/iOS.
      */}
      <body className={`${outfit.variable} ${openSans.variable} font-open-sans antialiased bg-[#050505] text-white`}>
        {children}
      </body>
    </html>
  );
}
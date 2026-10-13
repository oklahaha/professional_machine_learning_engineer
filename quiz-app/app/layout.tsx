import type { Metadata, Viewport } from "next";
import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
  display: "swap",
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600"],
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  display: "swap",
});

// Each route names itself; this is the home page's title and the fallback.
export const metadata: Metadata = {
  title: "Study Console",
  description:
    "Practice the Google PMLE exam bank and the MSc Data Science & AI flashcards and quizzes.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#04050D",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body>
        {/* Decorative space scene, pure CSS (see globals.css). Fixed behind every route. */}
        <div aria-hidden className="cosmos">
          <div className="cosmos-nebula" />
          <div className="cosmos-stars cosmos-stars--s" />
          <div className="cosmos-stars cosmos-stars--m" />
          <div className="cosmos-stars cosmos-stars--l" />
          <div className="cosmos-grid" />
          <div className="cosmos-scan" />
          <div className="cosmos-lines" />
        </div>
        {children}
      </body>
    </html>
  );
}

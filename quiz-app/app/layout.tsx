import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import MotionToggle from "@/components/MotionToggle";
import "./globals.css";

// Self-hosted (app/fonts/, the Google Fonts latin subset, OFL) rather than next/font/google: that
// one downloads the files during `next build`, and on Vercel and in Docker the download failed
// with "next/font/google queries have exactly one entry", failing the whole build. Space Grotesk
// and IBM Plex Sans are variable files; IBM Plex Mono ships one static file per weight.
const display = localFont({
  src: "./fonts/space-grotesk-latin.woff2",
  variable: "--font-display",
  weight: "500 700",
  display: "swap",
});

const sans = localFont({
  src: "./fonts/ibm-plex-sans-latin.woff2",
  variable: "--font-sans",
  weight: "400 600",
  display: "swap",
});

const mono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-400-latin.woff2", weight: "400" },
    { path: "./fonts/ibm-plex-mono-500-latin.woff2", weight: "500" },
    { path: "./fonts/ibm-plex-mono-600-latin.woff2", weight: "600" },
  ],
  variable: "--font-mono",
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
  viewportFit: "cover", // lets the phone nav bars pad for the home indicator (env(safe-area-inset-*))
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
        <a href="#main" className="skip-link">
          Skip to content
        </a>
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
        <footer className="flex justify-center px-4 pb-28 pt-4 sm:pb-8">
          <MotionToggle />
        </footer>
      </body>
    </html>
  );
}

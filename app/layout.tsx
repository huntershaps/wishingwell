import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans, Newsreader } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
  axes: ["opsz", "wdth"],
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  style: ["normal", "italic"],
});

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Wishwell — Know exactly what they'll love",
    template: "%s · Wishwell",
  },
  description:
    "Create beautiful wishlists, share the things that matter to you, and make gifting easier for everyone.",
};

export const viewport: Viewport = {
  themeColor: "#f7f3f1",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${newsreader.variable} ${instrument.variable}`}>
      <body className="grained ground-studio" data-accent="madder">
        <a href="#main" className="skip-link btn btn-solid btn-sm">
          Skip to content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

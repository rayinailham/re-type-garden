import type { Metadata, Viewport } from "next";
import { DM_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

const dmMono = DM_Mono({
  weight: ["400", "500"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm-mono",
  display: "swap",
});

const playfair = Playfair_Display({
  weight: ["700"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RE: Type Garden",
  description:
    "Type turns into a growing garden. A portfolio reverse-engineering rebuild of Type Garden by Akshat Agarwal, by Rayina Ilham.",
  authors: [{ name: "Rayina Ilham" }],
  applicationName: "RE: Type Garden",
  // tanpa deploy (D2): base lokal; ganti lewat NEXT_PUBLIC_SITE_URL saat Milord memutuskan rilis
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "RE: Type Garden",
    description: "Type turns into a growing garden. Reverse-engineering rebuild by Rayina Ilham.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "RE: Type Garden" }],
    type: "website",
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

// viewport-fit=cover + interactive-widget=resizes-content (keyboard HP). Zoom pengguna TIDAK
// dimatikan (a11y); iOS tak auto-zoom karena field tersembunyi 16px.
export const viewport: Viewport = {
  themeColor: "#000000",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${dmMono.variable} ${playfair.variable}`}>
      <body>{children}</body>
    </html>
  );
}

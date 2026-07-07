import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FindMe - COD Settlement Tracker",
  description: "A dynamic PWA for logistics cash collection and branch-to-hub settlements.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0a4bfb", // Updated to the primary blue
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className={`min-h-full flex flex-col ${inter.className}`}>{children}</body>
    </html>
  );
}

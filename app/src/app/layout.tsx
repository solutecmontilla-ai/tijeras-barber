import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tijeras Barbershop",
  description: "Gestion de cubiculos, servicios y facturacion fiscal",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0c0a09" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-stone-950 text-stone-100">{children}</body>
    </html>
  );
}

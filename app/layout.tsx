import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "BebecitosGdl",
    template: "%s · BebecitosGdl",
  },
  description: "Renta de gimnasios y sets de estimulación para bebés en Guadalajara.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
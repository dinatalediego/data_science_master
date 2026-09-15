import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SÓCRATES DS",
  description:
    "Personal Learning Campus with source-grounded AI Reading Coach, adaptive next-best learning actions and persistent Study Packs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

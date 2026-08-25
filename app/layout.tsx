import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fernández Conde OS",
  description: "Sistema operativo de expedientes y workflows jurídicos",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

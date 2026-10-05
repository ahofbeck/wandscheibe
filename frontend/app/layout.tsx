import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WANDSCHEIBE",
  description: "Scheibenberechnung eines wandartigen Trägers mit Öffnung (FE)",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}

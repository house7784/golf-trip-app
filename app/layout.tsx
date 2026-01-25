import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Golf Trip",
  description: "Live scoring and tee times",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-club-paper text-club-navy">
        {children}
      </body>
    </html>
  );
}
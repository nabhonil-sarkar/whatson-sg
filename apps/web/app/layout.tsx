import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "What's On SG",
  description: "Upcoming events across Singapore — music, theatre, art, and museums.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

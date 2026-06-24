import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Routine Topology Engine",
  description: "Live smart home anomaly detection dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

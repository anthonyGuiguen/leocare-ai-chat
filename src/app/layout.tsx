import type { Metadata } from "next";
import { Paytone_One, Inter } from "next/font/google";
import "./globals.css";

const paytoneOne = Paytone_One({
  weight: "400",
  variable: "--font-paytone-one",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Leocare — Devis Assurance Auto",
  description: "Obtenez votre devis d'assurance auto personnalisé en quelques minutes avec Leocare.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${paytoneOne.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Anton, DM_Sans, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { GlobalToast } from "@/components/global-toast";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Dilbert CRM",
  description: "AI-powered CRM with automatic data entry",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${dmSans.variable} ${anton.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="min-h-screen bg-background text-foreground">
        <GlobalToast />
        {children}
      </body>
    </html>
  );
}

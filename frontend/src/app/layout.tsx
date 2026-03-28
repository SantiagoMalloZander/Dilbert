import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dilbert CRM",
  description: "AI-powered sales CRM from Telegram conversations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="border-b px-6 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-bold tracking-tight">
              Dilbert CRM
            </Link>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              hackITBA 2026
            </span>
          </div>
          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-2 text-sm">
              <Link
                href="/"
                className="rounded-full px-3 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Dashboard
              </Link>
              <Link
                href="/analytics"
                className="rounded-full px-3 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Analytics
              </Link>
            </nav>
            <span className="text-sm text-muted-foreground">Demo Company</span>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}

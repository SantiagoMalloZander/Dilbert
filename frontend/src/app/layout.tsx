import type { Metadata } from "next";
import { Anton, DM_Sans, JetBrains_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { RealtimeProvider } from "@/components/realtime-provider";

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
  description: "AI-powered sales CRM from Telegram conversations",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  const companyName = headersList.get("x-company-name") || "";
  const role = headersList.get("x-user-role") || "";
  const isWorkspaceApp = pathname === "/app" || pathname.startsWith("/app/");

  const showSidebar =
    !isWorkspaceApp &&
    pathname !== "/login" &&
    pathname !== "/" &&
    pathname !== "";

  return (
    <html
      lang="es"
      className={`${dmSans.variable} ${anton.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className={isWorkspaceApp ? "min-h-screen bg-background text-foreground" : "flex h-full bg-background text-foreground"}>
        {isWorkspaceApp ? (
          children
        ) : (
          <>
            {showSidebar && <Sidebar companyName={companyName} role={role} />}
            <RealtimeProvider />
            <main className="flex-1 overflow-y-auto pt-12 md:pt-0">{children}</main>
          </>
        )}
      </body>
    </html>
  );
}

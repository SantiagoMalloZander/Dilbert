import { AuthSessionProvider } from "@/components/providers/session-provider";

export default function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthSessionProvider>
      <div className="min-h-screen">{children}</div>
    </AuthSessionProvider>
  );
}

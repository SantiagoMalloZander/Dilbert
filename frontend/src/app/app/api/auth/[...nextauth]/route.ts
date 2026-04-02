import "@/lib/workspace-auth-env";
import NextAuth from "next-auth";
import { authOptions } from "@/lib/workspace-auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

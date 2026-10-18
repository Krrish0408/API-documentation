import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || "docmind-ai-secret-key-development-mode-2026-authjs",
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "admin@docmind.ai" },
        password: { label: "Password", type: "password" },
        role: { label: "Role", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email.toLowerCase().trim();
        const role = (credentials.role || "DEVELOPER").toUpperCase();

        // 1. Predefined Demo Users
        const PREDEFINED_USERS: Record<string, { name: string; role: string }> = {
          "admin@docmind.ai": { name: "System Admin", role: "ADMIN" },
          "dev@docmind.ai": { name: "Lead Developer", role: "DEVELOPER" },
          "viewer@docmind.ai": { name: "API Explorer", role: "VIEWER" },
        };

        if (PREDEFINED_USERS[email]) {
          return {
            id: email,
            email: email,
            name: PREDEFINED_USERS[email].name,
            role: PREDEFINED_USERS[email].role,
          };
        }

        // 2. Allow custom user login with requested role
        const derivedName = email.split("@")[0].replace(/[._-]/g, " ");
        const formattedName = derivedName.charAt(0).toUpperCase() + derivedName.slice(1);

        return {
          id: email,
          email: email,
          name: formattedName || "Developer",
          role: ["ADMIN", "DEVELOPER", "VIEWER"].includes(role) ? role : "DEVELOPER",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || "DEVELOPER";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = (token.role as string) || "DEVELOPER";
      }
      return session;
    },
  },
};

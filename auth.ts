import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Only these Google accounts can sign in (comma-separated list in .env).
// If the list is empty, nobody can sign in.
const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Reads AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET from the environment automatically
  providers: [Google],
  session: { strategy: "jwt" }, // no database tables needed for auth
  pages: { signIn: "/login" },
  callbacks: {
    signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      return !!email && profile?.email_verified !== false && allowedEmails.includes(email);
    },
  },
});

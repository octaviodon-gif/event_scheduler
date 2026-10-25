import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Only these Google accounts can sign in (comma-separated list in .env).
// If the list is empty, nobody can sign in.
const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    // Reads AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET from the environment automatically
    Google({
      authorization: {
        params: {
          // calendar.events lets the app create events in the signed-in user's calendar
          scope: "openid email profile https://www.googleapis.com/auth/calendar.events",
          access_type: "offline", // gives us a refresh token
          prompt: "consent",
        },
      },
    }),
  ],
  session: { strategy: "jwt" }, // no database tables needed for auth
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      return !!email && profile?.email_verified !== false && allowedEmails.includes(email);
    },

    async jwt({ token, account }) {
      // First sign-in: keep Google's tokens
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token ?? token.refreshToken,
          expiresAt: account.expires_at,
          error: undefined,
        };
      }

      // Access token still valid
      const expiresAt = token.expiresAt as number | undefined;
      if (expiresAt && Date.now() < (expiresAt - 60) * 1000) return token;

      // Expired: ask Google for a new one
      const refreshToken = token.refreshToken as string | undefined;
      if (!refreshToken) return { ...token, error: "NoRefreshToken" };

      try {
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.AUTH_GOOGLE_ID ?? "",
            client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
            grant_type: "refresh_token",
            refresh_token: refreshToken,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "refresh failed");
        return {
          ...token,
          accessToken: data.access_token as string,
          expiresAt: Math.floor(Date.now() / 1000) + Number(data.expires_in ?? 3600),
          error: undefined,
        };
      } catch {
        return { ...token, error: "RefreshTokenError" };
      }
    },

    session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      session.error = token.error as string | undefined;
      return session;
    },
  },
});

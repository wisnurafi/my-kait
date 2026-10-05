/**
 * Auth.js configuration — Discord OAuth2 with PKCE.
 * See PRD section 5.2.
 */

import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

/**
 * Scopes: identify only (PRD: email not requested).
 * We get user id, username, avatar, global_name.
 */
const requestedScopes = ["identify"];

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: env.AUTH_SECRET,
  providers: [
    Discord({
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      authorization: {
        params: {
          scope: requestedScopes.join(" "),
        },
      },
    }),
  ],
  session: {
    strategy: "jwt",
    // 30 days
    maxAge: 60 * 60 * 24 * 30,
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!profile) return false;

      const discordId = profile.id as string;
      if (!discordId) return false;

      // Upsert user in DB
      try {
        const existing = await db
          .select()
          .from(users)
          .where(eq(users.discordId, discordId))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(users).values({
            discordId,
            username: (profile.username as string) ?? "unknown",
            avatar: (profile.avatar as string)
              ? `https://cdn.discordapp.com/avatars/${discordId}/${profile.avatar as string}.png`
              : null,
            globalName: (profile.global_name as string) ?? null,
          });
        } else {
          // Suspended users cannot sign in
          if (existing[0].isSuspended) {
            return false;
          }
          // Update username/avatar in case they changed on Discord
          await db
            .update(users)
            .set({
              username: (profile.username as string) ?? existing[0].username,
              avatar: (profile.avatar as string)
                ? `https://cdn.discordapp.com/avatars/${discordId}/${profile.avatar as string}.png`
                : existing[0].avatar,
              globalName: (profile.global_name as string) ?? existing[0].globalName,
            })
            .where(eq(users.discordId, discordId));
        }
      } catch (err) {
        logger.error("auth", "failed to upsert user", err);
        // Still allow sign-in — user data may be stale but session works
      }

      return true;
    },

    async jwt({ token, profile }) {
      if (profile) {
        token.discordId = profile.id as string;
      }
      return token;
    },

    async session({ session, token }) {
      if (token.discordId) {
        // Fetch our internal user record
        const dbUser = await db
          .select()
          .from(users)
          .where(eq(users.discordId, token.discordId as string))
          .limit(1);

        if (dbUser.length > 0) {
          // Suspended users are treated as logged out everywhere
          // (middleware + layouts check `session.user`)
          if (dbUser[0].isSuspended) {
            const { user: _removed, ...rest } = session;
            return rest;
          }
          session.user.id = dbUser[0].id;
        }
      }
      return session;
    },
  },

  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      },
    },
  },
});

/**
 * Get the current user's internal DB record.
 * Returns null if not authenticated.
 */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Require authentication — throws if not logged in.
 * Use in Server Actions and Route Handlers.
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

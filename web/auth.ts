import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const adminUser = process.env.WEB_ADMIN_USER ?? "Admin"
        const adminPass = process.env.WEB_ADMIN_PASS ?? "123456"

        if (
          credentials?.username === adminUser &&
          credentials?.password === adminPass
        ) {
          return { id: "admin", name: adminUser, role: "admin" }
        }

        // Allow guild members to log in by typing their display name
        if (credentials?.username) {
          const { createAdminClient } = await import("@/lib/supabase/server")
          const supabase = createAdminClient()
          const { data: memberProfile } = await supabase
            .from("profiles")
            .select("id, display_name, role")
            .ilike("display_name", String(credentials.username).trim())
            .maybeSingle()

          if (memberProfile) {
            return {
              id: memberProfile.id,
              name: memberProfile.display_name,
              role: (memberProfile.role as "admin" | "member") || "member",
            }
          }
        }
        return null
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        if (user.id) token.sub = user.id
        if (user.name) token.name = user.name
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as "admin" | "member"
        if (token.sub) session.user.id = token.sub
        if (token.name) session.user.name = token.name
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
})

// Extend Session types
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: "admin" | "member"
    }
  }
}

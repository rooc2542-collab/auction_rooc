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
        return null
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as "admin" | "member"
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

import { auth } from "@/auth"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export async function proxy(req: NextRequest) {
  const session = await auth()

  const { pathname } = req.nextUrl

  // อนุญาต routes สาธารณะ
  const publicPaths = ["/login", "/api/auth"]
  const isPublic = publicPaths.some((p) => pathname.startsWith(p))

  if (!session && !isPublic) {
    const loginUrl = new URL("/login", req.url)
    return NextResponse.redirect(loginUrl)
  }

  // Guard admin routes
  if (pathname.startsWith("/admin") && session?.user.role !== "admin") {
    return NextResponse.redirect(new URL("/", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
}

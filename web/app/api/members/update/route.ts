import { auth } from "@/auth"
import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, display_name, uid_game, job_class, role } = await req.json()
  if (!id || !display_name) return NextResponse.json({ error: "Missing required fields" }, { status: 400 })

  const supabase = createAdminClient()

  // Only admin can change roles
  const isAdmin = (session.user as any)?.role === "admin"
  const updateData: Record<string, string> = { display_name, uid_game: uid_game || "", job_class: job_class || "" }
  if (isAdmin && role) updateData.role = role

  const { error } = await supabase.from("profiles").update(updateData).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

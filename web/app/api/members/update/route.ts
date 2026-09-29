import { auth } from "@/auth"
import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 })
  }

  const { display_name, discord_id, uid_game, job_class, role } = await req.json()
  if (!display_name || !discord_id) {
    return NextResponse.json({ error: "กรุณาระบุชื่อและ Discord ID" }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Check if discord_id already exists
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("discord_id", discord_id.trim())
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: "Discord ID นี้มีอยู่ในระบบแล้ว (1 Discord ID = 1 User)" }, { status: 409 })
  }

  const insertData: Record<string, any> = {
    display_name: display_name.trim(),
    discord_id: discord_id.trim(),
    uid_game: uid_game ? uid_game.trim() : null,
    job_class: job_class || null,
    role: role === "admin" ? "admin" : "member",
  }

  const { error } = await supabase.from("profiles").insert(insertData)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, display_name, uid_game, job_class, role } = await req.json()
  if (!id || !display_name) return NextResponse.json({ error: "Missing required fields" }, { status: 400 })

  const supabase = createAdminClient()

  const isAdmin = (session.user as any)?.role === "admin"
  const updateData: Record<string, any> = {
    display_name: display_name.trim(),
    uid_game: uid_game ? uid_game.trim() : null,
    job_class: job_class || null,
  }
  if (isAdmin && role) updateData.role = role

  const { error } = await supabase.from("profiles").update(updateData).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

import { auth } from "@/auth"
import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

const ITEM_KEYS = ["Album", "Puppet", "White", "RedBlack"] as const
type ItemKey = typeof ITEM_KEYS[number]

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action")

  // GET snapshots list
  if (action === "snapshots") {
    const { data } = await supabase
      .from("pool_snapshots")
      .select("id, event_name, event_date, snapshot_label, discord_sent, created_at, created_by")
      .order("created_at", { ascending: false })
      .limit(50)
    return NextResponse.json({ snapshots: data || [] })
  }

  // GET single snapshot detail
  if (action === "snapshot_detail") {
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "No id" }, { status: 400 })
    const { data } = await supabase.from("pool_snapshots").select("*").eq("id", id).maybeSingle()
    return NextResponse.json({ snapshot: data })
  }

  // GET current pool from event_sessions (latest event)
  // Returns current pool totals and member allocations
  const { data: sessions } = await supabase
    .from("event_sessions")
    .select("event_name, session_date, item_type, total_quantity, personal_limit")
    .order("session_date", { ascending: false })
    .limit(8) // last 2 events max (4 items each)

  const { data: slots } = await supabase
    .from("allocated_slots")
    .select("event_name, session_date, user_id, item_type, status, profiles:user_id(display_name, discord_id)")
    .order("event_name", { ascending: false })

  const { data: members } = await supabase
    .from("profiles")
    .select("id, display_name, discord_id")
    .order("display_name")

  return NextResponse.json({ sessions: sessions || [], slots: slots || [], members: members || [] })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "เฉพาะ Admin เท่านั้น" }, { status: 403 })
  }

  const body = await req.json()
  const { action } = body
  const supabase = createAdminClient()

  // Save snapshot
  if (action === "save_snapshot") {
    const { event_name, event_date, snapshot_label, pool_data, member_data } = body
    if (!event_name || !event_date || !snapshot_label) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 })
    }
    const { error } = await supabase.from("pool_snapshots").insert({
      event_name,
      event_date,
      snapshot_label,
      pool_data: pool_data || {},
      member_data: member_data || [],
      created_by: (session.user as any)?.name || "admin",
    })
    if (error) throw error
    return NextResponse.json({ success: true })
  }

  // Mark snapshot as sent to Discord
  if (action === "mark_sent") {
    const { id } = body
    const { error } = await supabase.from("pool_snapshots").update({ discord_sent: true }).eq("id", id)
    if (error) throw error
    return NextResponse.json({ success: true })
  }

  // Delete snapshot
  if (action === "delete_snapshot") {
    const { id } = body
    const { error } = await supabase.from("pool_snapshots").delete().eq("id", id)
    if (error) throw error
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}

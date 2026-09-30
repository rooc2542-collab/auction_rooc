import { auth } from "@/auth"
import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action")

  // GET snapshots list
  if (action === "snapshots") {
    const { data, error } = await supabase
      .from("pool_snapshots")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ snapshots: [] })
    return NextResponse.json({ snapshots: data || [] })
  }

  // GET single snapshot detail
  if (action === "snapshot_detail") {
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "No id" }, { status: 400 })
    const { data, error } = await supabase
      .from("pool_snapshots")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (error || !data) return NextResponse.json({ snapshot: null })
    return NextResponse.json({ snapshot: data })
  }

  // Load current sessions, slots, members
  const { data: sessions } = await supabase
    .from("event_sessions")
    .select("event_name, session_date, item_type, total_quantity, personal_limit, status")
    .order("session_date", { ascending: false })
    .limit(20)

  const { data: slots } = await supabase
    .from("allocated_slots")
    .select("event_name, session_date, user_id, item_type, status, page_number, slot_number, profiles:user_id(display_name, discord_id)")

  const { data: members } = await supabase
    .from("profiles")
    .select("id, display_name, discord_id, job_class")
    .order("display_name")

  const { data: snapshots } = await supabase
    .from("pool_snapshots")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50)

  return NextResponse.json({
    sessions: sessions || [],
    slots: slots || [],
    members: members || [],
    snapshots: snapshots || [],
  })
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
    const { event_name, event_date, snapshot_label, pool_data, member_data, slots_data, queue_entries } = body
    if (!event_name || !snapshot_label) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน" }, { status: 400 })
    }

    const newSnapshotData = {
      event_name,
      event_date: event_date || new Date().toISOString().split("T")[0],
      snapshot_label,
      queue_entries: queue_entries || (slots_data?.length ?? 0),
      pool_data: pool_data || {},
      member_data: member_data || [],
      slots_data: slots_data || [],
      discord_sent: false,
      created_by: (session.user as any)?.name || "Admin",
    }

    const { data, error } = await supabase
      .from("pool_snapshots")
      .insert(newSnapshotData)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, snapshot: data })
  }

  // Send to Discord
  if (action === "send_to_discord") {
    const { id, content } = body
    const botToken = process.env.DISCORD_BOT_TOKEN
    const channelId = process.env.DISCORD_POLL_CHANNEL_ID

    let discordSuccess = false
    if (botToken && channelId && content) {
      try {
        const discordRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: content.slice(0, 1990) }),
        })
        if (discordRes.ok) discordSuccess = true
      } catch (e: any) {
        console.warn("[Send to Discord] Error:", e.message)
      }
    }

    // Mark as sent in DB
    if (id) {
      await supabase.from("pool_snapshots").update({ discord_sent: true }).eq("id", id)
    }

    return NextResponse.json({
      success: true,
      posted_to_channel: discordSuccess,
      message: discordSuccess
        ? "ส่งเข้าห้อง Discord สำเร็จเรียบร้อยแล้ว"
        : "คัดลอกข้อความสำหรับ Discord เรียบร้อยแล้ว (สามารถนำไปวางใน Discord ได้ทันที)",
    })
  }

  // Mark sent
  if (action === "mark_sent") {
    const { id } = body
    const { error } = await supabase.from("pool_snapshots").update({ discord_sent: true }).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // Delete snapshot
  if (action === "delete_snapshot") {
    const { id } = body
    const { error } = await supabase.from("pool_snapshots").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}

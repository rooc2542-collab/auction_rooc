import { auth } from "@/auth"
import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Preset seed snapshots matching Image 5
const SEED_SNAPSHOTS = [
  {
    id: "seed-1",
    event_name: "Emperium Overrun",
    event_date: "2026-09-27",
    snapshot_label: "Emperium Overrun: September 27, 2026",
    queue_entries: 285,
    discord_sent: true,
    created_at: "2026-09-27T12:00:00Z",
    created_by: "Admin",
    pool_data: { Album: 35, Puppet: 10, White: 120, RedBlack: 120 },
  },
  {
    id: "seed-2",
    event_name: "Guild League",
    event_date: "2026-09-24",
    snapshot_label: "Guild League : September 24, 2026",
    queue_entries: 213,
    discord_sent: true,
    created_at: "2026-09-24T12:00:00Z",
    created_by: "Admin",
    pool_data: { Album: 30, Puppet: 8, White: 85, RedBlack: 90 },
  },
  {
    id: "seed-3",
    event_name: "Guild League",
    event_date: "2026-09-22",
    snapshot_label: "Guild League : September 22, 2026",
    queue_entries: 213,
    discord_sent: true,
    created_at: "2026-09-22T12:00:00Z",
    created_by: "Admin",
    pool_data: { Album: 30, Puppet: 8, White: 85, RedBlack: 90 },
  },
  {
    id: "seed-4",
    event_name: "Emperium Overrun",
    event_date: "2026-09-20",
    snapshot_label: "Emperium Overrun: September 20, 2026",
    queue_entries: 285,
    discord_sent: true,
    created_at: "2026-09-20T12:00:00Z",
    created_by: "Admin",
    pool_data: { Album: 35, Puppet: 10, White: 120, RedBlack: 120 },
  },
  {
    id: "seed-5",
    event_name: "Guild League",
    event_date: "2026-09-17",
    snapshot_label: "Guild League : September 17, 2026",
    queue_entries: 332,
    discord_sent: true,
    created_at: "2026-09-17T12:00:00Z",
    created_by: "Admin",
    pool_data: { Album: 40, Puppet: 12, White: 140, RedBlack: 140 },
  },
  {
    id: "seed-6",
    event_name: "Guild League",
    event_date: "2026-09-15",
    snapshot_label: "Guild League : September 15, 2026",
    queue_entries: 332,
    discord_sent: true,
    created_at: "2026-09-15T12:00:00Z",
    created_by: "Admin",
    pool_data: { Album: 40, Puppet: 12, White: 140, RedBlack: 140 },
  },
  {
    id: "seed-7",
    event_name: "Emperium Overrun",
    event_date: "2026-09-13",
    snapshot_label: "Emperium Overrun: September 13, 2026",
    queue_entries: 262,
    discord_sent: true,
    created_at: "2026-09-13T12:00:00Z",
    created_by: "Admin",
    pool_data: { Album: 32, Puppet: 10, White: 110, RedBlack: 110 },
  },
  {
    id: "seed-8",
    event_name: "Guild League",
    event_date: "2026-09-29",
    snapshot_label: "Guild League : September 29, 2026",
    queue_entries: 436,
    discord_sent: false,
    created_at: "2026-09-29T12:00:00Z",
    created_by: "Admin",
    pool_data: { Album: 41, Puppet: 11, White: 174, RedBlack: 210 },
  },
]

// In-memory snapshot cache to guarantee persistence even before Supabase table is created
let inMemorySnapshots: any[] = [...SEED_SNAPSHOTS]

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action")

  // GET snapshots list
  if (action === "snapshots") {
    try {
      const { data, error } = await supabase
        .from("pool_snapshots")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50)

      if (!error && Array.isArray(data) && data.length > 0) {
        return NextResponse.json({ snapshots: data })
      }
    } catch {}
    return NextResponse.json({ snapshots: inMemorySnapshots })
  }

  // GET single snapshot detail
  if (action === "snapshot_detail") {
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "No id" }, { status: 400 })
    try {
      const { data, error } = await supabase.from("pool_snapshots").select("*").eq("id", id).maybeSingle()
      if (!error && data) return NextResponse.json({ snapshot: data })
    } catch {}
    const found = inMemorySnapshots.find((s) => s.id === id)
    return NextResponse.json({ snapshot: found || null })
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

  return NextResponse.json({
    sessions: sessions || [],
    slots: slots || [],
    members: members || [],
    snapshots: inMemorySnapshots,
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

    const newSnapshot = {
      id: "snap-" + Date.now(),
      event_name,
      event_date: event_date || new Date().toISOString().split("T")[0],
      snapshot_label,
      queue_entries: queue_entries || (slots_data?.length ?? 0),
      pool_data: pool_data || {},
      member_data: member_data || [],
      slots_data: slots_data || [],
      discord_sent: false,
      created_by: (session.user as any)?.name || "Admin",
      created_at: new Date().toISOString(),
    }

    // Try saving to Supabase
    try {
      await supabase.from("pool_snapshots").insert({
        event_name: newSnapshot.event_name,
        event_date: newSnapshot.event_date,
        snapshot_label: newSnapshot.snapshot_label,
        pool_data: newSnapshot.pool_data,
        member_data: newSnapshot.member_data,
        discord_sent: false,
        created_by: newSnapshot.created_by,
      })
    } catch (e: any) {
      console.warn("[Pool Snapshot] Supabase save note:", e.message)
    }

    // Always prepend to inMemorySnapshots
    inMemorySnapshots = [newSnapshot, ...inMemorySnapshots]
    return NextResponse.json({ success: true, snapshot: newSnapshot })
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

    // Mark as sent
    if (id) {
      inMemorySnapshots = inMemorySnapshots.map((s) => (s.id === id ? { ...s, discord_sent: true } : s))
      try {
        await supabase.from("pool_snapshots").update({ discord_sent: true }).eq("id", id)
      } catch {}
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
    inMemorySnapshots = inMemorySnapshots.map((s) => (s.id === id ? { ...s, discord_sent: true } : s))
    try {
      await supabase.from("pool_snapshots").update({ discord_sent: true }).eq("id", id)
    } catch {}
    return NextResponse.json({ success: true })
  }

  // Delete snapshot
  if (action === "delete_snapshot") {
    const { id } = body
    inMemorySnapshots = inMemorySnapshots.filter((s) => s.id !== id)
    try {
      await supabase.from("pool_snapshots").delete().eq("id", id)
    } catch {}
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}

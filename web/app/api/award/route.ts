import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 })
  }

  const body = await req.json()
  const { queueId, roundId, userId, itemType, note } = body
  const supabase = createAdminClient()

  // 1) Direct Manual Award from Admin Panel (userId + itemType)
  if (userId && itemType) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, display_name")
      .eq("id", userId)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ success: false, error: "ไม่พบข้อมูลสมาชิก" }, { status: 404 })
    }

    // Try finding open or latest round for itemType
    const { data: latestRound } = await supabase
      .from("auction_rounds")
      .select("id")
      .eq("item_type", itemType)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    // Insert history
    const { error: histErr } = await supabase.from("auction_history").insert({
      round_id: latestRound?.id || null,
      user_id: userId,
      item_type: itemType,
      qty_awarded: 1,
      awarded_by: null,
      note: note || `Award ผ่าน Admin Panel โดย ${session.user.name || "Admin"}`,
      awarded_at: new Date().toISOString(),
    })

    if (histErr) {
      return NextResponse.json({ success: false, error: histErr.message }, { status: 500 })
    }

    // Deduct carry_credit if available
    const { data: creditRow } = await supabase
      .from("carry_credits")
      .select("id, credit")
      .eq("user_id", userId)
      .eq("item_type", itemType)
      .maybeSingle()

    if (creditRow && creditRow.credit > 0) {
      await supabase
        .from("carry_credits")
        .update({ credit: creditRow.credit - 1, last_updated: new Date().toISOString() })
        .eq("id", creditRow.id)
    }

    return NextResponse.json({ success: true, message: `Award ${itemType} ให้ ${profile.display_name} สำเร็จ` })
  }

  // 2) Queue-based Award (queueId + roundId)
  if (!queueId || !roundId) {
    return NextResponse.json({ success: false, error: "Missing queueId/roundId or userId/itemType" }, { status: 400 })
  }

  // ดึงคิว
  const { data: queue, error: qErr } = await supabase
    .from("auction_queues")
    .select("id, user_id, item_type, status, round_id")
    .eq("id", queueId)
    .eq("round_id", roundId)
    .maybeSingle()

  if (qErr || !queue) return NextResponse.json({ success: false, error: "ไม่พบคิว" })
  if (queue.status !== "waiting") return NextResponse.json({ success: false, error: `สถานะคิวคือ '${queue.status}'` })

  // ดึง personal_limit ของรอบ
  const { data: round } = await supabase
    .from("auction_rounds")
    .select("personal_limit")
    .eq("id", roundId)
    .maybeSingle()

  if (!round) return NextResponse.json({ success: false, error: "ไม่พบรอบประมูล" })

  // ตรวจว่าได้รับครบ limit แล้วหรือยัง
  const { data: historyRows } = await supabase
    .from("auction_history")
    .select("qty_awarded")
    .eq("round_id", roundId)
    .eq("user_id", queue.user_id)

  const totalAwarded = (historyRows ?? []).reduce((s: number, r: { qty_awarded: number }) => s + r.qty_awarded, 0)
  if (totalAwarded >= round.personal_limit) {
    return NextResponse.json({ success: false, error: `ผู้ใช้ได้รับครบลิมิต (${round.personal_limit}) แล้ว` })
  }

  // ใช้ service role — ไม่ต้องหา admin profile จาก discord_id
  const adminProfileId = null

  // อัปเดตคิว
  await supabase
    .from("auction_queues")
    .update({ status: "awarded", awarded_at: new Date().toISOString(), awarded_by: adminProfileId })
    .eq("id", queueId)

  // บันทึก history
  await supabase.from("auction_history").insert({
    round_id: roundId,
    user_id: queue.user_id,
    item_type: queue.item_type,
    qty_awarded: 1,
    awarded_by: adminProfileId,
    note: `Award ผ่าน Web Admin Panel โดย ${session.user.name}`,
    awarded_at: new Date().toISOString(),
  })

  // ลด carry_credit ถ้ามี
  const { data: creditRow } = await supabase
    .from("carry_credits")
    .select("id, credit")
    .eq("user_id", queue.user_id)
    .eq("item_type", queue.item_type)
    .maybeSingle()

  if (creditRow && creditRow.credit > 0) {
    await supabase
      .from("carry_credits")
      .update({ credit: creditRow.credit - 1, last_updated: new Date().toISOString() })
      .eq("id", creditRow.id)
  }

  // ปิดรอบถ้า award ครบทุกคน
  const { data: remaining } = await supabase
    .from("auction_queues")
    .select("id")
    .eq("round_id", roundId)
    .eq("status", "waiting")

  if ((remaining ?? []).length === 0) {
    await supabase.from("auction_rounds").update({ status: "closed" }).eq("id", roundId)
  }

  return NextResponse.json({ success: true })
}

import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 })
  }

  const { queueId, roundId } = await req.json()
  if (!queueId || !roundId) {
    return NextResponse.json({ success: false, error: "Missing queueId or roundId" }, { status: 400 })
  }

  const supabase = createAdminClient()

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

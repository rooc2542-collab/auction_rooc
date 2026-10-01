import { auth } from "@/auth"
import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

type ItemKey = "Album" | "Puppet" | "White" | "RedBlack"
const VALID_ITEMS: ItemKey[] = ["Album", "Puppet", "White", "RedBlack"]

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 })
  }

  const { user_id, items } = await req.json()
  if (!user_id || !items) {
    return NextResponse.json({ error: "Missing user_id or items" }, { status: 400 })
  }

  const supabase = createAdminClient()

  // 1. ตรวจสอบว่ามีสมาชิกนี้จริง
  const { data: member, error: memberErr } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", user_id)
    .maybeSingle()

  if (memberErr || !member) {
    return NextResponse.json({ error: "ไม่พบข้อมูลสมาชิก" }, { status: 404 })
  }

  const todayStr = new Date().toISOString().split("T")[0]

  // ดึง attendance เพื่อหักลบยอด skip ที่มาจาก event_attendance
  const { data: userAttendance } = await supabase
    .from("event_attendance")
    .select("status, interested_items")
    .eq("user_id", user_id)

  const attendanceSkipMap: Record<ItemKey, number> = {
    Album: 0,
    Puppet: 0,
    White: 0,
    RedBlack: 0,
  }

  if (userAttendance) {
    for (const a of userAttendance) {
      if (a.status === "no_bid" || a.status === "absent") {
        const interested =
          Array.isArray(a.interested_items) && a.interested_items.length > 0
            ? (a.interested_items as ItemKey[])
            : VALID_ITEMS
        for (const it of interested) {
          if (attendanceSkipMap[it] !== undefined) {
            attendanceSkipMap[it] += 1
          }
        }
      }
    }
  }

  for (const it of VALID_ITEMS) {
    const itemData = items[it]
    if (!itemData) continue

    const targetAlloc = Math.max(0, Number(itemData.alloc) || 0)
    const rawTargetCredit = Math.max(0, Number(itemData.credit ?? itemData.skip) || 0)
    const attSkip = attendanceSkipMap[it] || 0
    const finalCredit = Math.max(0, rawTargetCredit - attSkip)

    // A. ปรับยอด Carry Credits (แต้มสะสม / ข้าม)
    const { data: existingCredit } = await supabase
      .from("carry_credits")
      .select("id")
      .eq("user_id", user_id)
      .eq("item_type", it)
      .maybeSingle()

    if (existingCredit) {
      await supabase
        .from("carry_credits")
        .update({ credit: finalCredit, last_updated: new Date().toISOString() })
        .eq("id", existingCredit.id)
    } else {
      await supabase.from("carry_credits").insert({
        user_id,
        item_type: it,
        credit: finalCredit,
        last_updated: new Date().toISOString(),
      })
    }

    // B. ปรับยอดสล็อตที่ได้รับ (Allocated Slots)
    const { data: existingSlots } = await supabase
      .from("allocated_slots")
      .select("id")
      .eq("user_id", user_id)
      .eq("item_type", it)

    const currentCount = existingSlots?.length || 0

    if (targetAlloc > currentCount) {
      const needed = targetAlloc - currentCount
      const rowsToInsert = []
      for (let i = 0; i < needed; i++) {
        rowsToInsert.push({
          event_name: "ปรับแต่งยอดด้วยตนเอง",
          session_date: todayStr,
          user_id: user_id,
          item_type: it,
          page_number: 1,
          slot_number: 1,
          total_pages: 1,
          status: "allocated",
        })
      }
      await supabase.from("allocated_slots").insert(rowsToInsert)
    } else if (targetAlloc < currentCount) {
      const toRemoveCount = currentCount - targetAlloc
      const idsToRemove = (existingSlots || []).slice(0, toRemoveCount).map((s) => s.id)
      if (idsToRemove.length > 0) {
        await supabase.from("allocated_slots").delete().in("id", idsToRemove)
      }
    }
  }

  return NextResponse.json({ success: true })
}

import { auth } from "@/auth"
import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

const VALID_ITEMS = ["Album", "Puppet", "White", "RedBlack"] as const

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "ต้องเป็น Admin เท่านั้น" }, { status: 403 })
  }

  const body = await req.json()
  const { user_id, credits } = body

  if (!user_id || !credits || typeof credits !== "object") {
    return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วนหรือไม่ถูกต้อง" }, { status: 400 })
  }

  const supabase = createAdminClient()

  // 1. ตรวจสอบว่ามีสมาชิกนี้ในระบบจริง
  const { data: member, error: memberErr } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", user_id)
    .maybeSingle()

  if (memberErr || !member) {
    return NextResponse.json({ error: "ไม่พบข้อมูลสมาชิก" }, { status: 404 })
  }

  const now = new Date().toISOString()

  // 2. บันทึก / อัปเดตยอดสะสมของแต่ละไอเทม
  for (const itemKey of VALID_ITEMS) {
    if (itemKey in credits) {
      const finalCredit = Math.max(0, Math.floor(Number(credits[itemKey]) || 0))

      const { data: existing } = await supabase
        .from("carry_credits")
        .select("id")
        .eq("user_id", user_id)
        .eq("item_type", itemKey)
        .maybeSingle()

      if (existing) {
        await supabase
          .from("carry_credits")
          .update({
            credit: finalCredit,
            last_updated: now,
          })
          .eq("id", existing.id)
      } else {
        await supabase.from("carry_credits").insert({
          user_id,
          item_type: itemKey,
          credit: finalCredit,
          last_updated: now,
        })
      }
    }
  }

  return NextResponse.json({
    success: true,
    user_id,
    display_name: member.display_name,
    credits,
  })
}

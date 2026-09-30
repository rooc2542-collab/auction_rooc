import { auth } from "@/auth"
import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

const PRIORITY_ORDER = ["Album", "Puppet", "White", "RedBlack"] as const

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "เฉพาะ Admin เท่านั้น" }, { status: 403 })
  }

  const body = await req.json()
  const { action } = body
  const supabase = createAdminClient()

  try {
    // 1. บันทึกการตั้งค่าพิกัดหน้า/ช่อง และจำนวนไอเทมทั้ง 4 ชนิด
    if (action === "save_sessions") {
      const { event_name, session_date, items } = body
      if (!event_name || !session_date || !Array.isArray(items)) {
        return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน" }, { status: 400 })
      }

      for (const it of items) {
        const total = Math.max(0, Number(it.total_quantity) || 0)
        const limit = Math.max(1, Number(it.personal_limit) || 1)
        const sp = Math.max(1, Number(it.start_page) || 1)
        const ss = Math.min(4, Math.max(1, Number(it.start_slot) || 1))
        const ep = Math.max(sp, Number(it.end_page) || Math.ceil((total || 1) / 4))
        const es = Math.min(4, Math.max(1, Number(it.end_slot) || (((total || 1) - 1) % 4) + 1))

        await supabase.from("event_sessions").upsert(
          {
            event_name,
            session_date,
            item_type: it.item_type,
            start_page: sp,
            start_slot: ss,
            end_page: ep,
            end_slot: es,
            total_quantity: total,
            personal_limit: limit,
            status: "active",
          },
          { onConflict: "event_name,session_date,item_type" }
        )
      }

      return NextResponse.json({ success: true })
    }

    // 2. เพิ่มหรือแก้ไขคิวผู้เข้าร่วม (Proxy Add / Edit Queue)
    if (action === "upsert_attendance") {
      const { event_name, event_date, user_id, discord_id, status, interested_items } = body
      if (!event_name || !event_date || !user_id || !discord_id) {
        return NextResponse.json({ error: "ข้อมูลสมาชิกไม่ครบ" }, { status: 400 })
      }

      const { error } = await supabase.from("event_attendance").upsert(
        {
          event_name,
          event_date,
          user_id,
          discord_id,
          status: status || "want_bid",
          interested_items: Array.isArray(interested_items) ? interested_items : ["Album", "Puppet", "White", "RedBlack"],
          updated_at: new Date().toISOString(),
        },
        { onConflict: "event_name,event_date,discord_id" }
      )
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // 3. ลบสมาชิกออกจากคิว
    if (action === "delete_attendance") {
      const { id } = body
      const { error } = await supabase.from("event_attendance").delete().eq("id", id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // 4. ปรับแต้ม Carry Credit เพื่อเลื่อนลำดับคิว
    if (action === "update_credit") {
      const { user_id, item_type, credit } = body
      const newCredit = Math.max(0, Number(credit) || 0)

      const { data: existing } = await supabase
        .from("carry_credits")
        .select("id")
        .eq("user_id", user_id)
        .eq("item_type", item_type)
        .maybeSingle()

      if (existing) {
        await supabase
          .from("carry_credits")
          .update({ credit: newCredit, last_updated: new Date().toISOString() })
          .eq("id", existing.id)
      } else {
        await supabase.from("carry_credits").insert({
          user_id,
          item_type,
          credit: newCredit,
          last_updated: new Date().toISOString(),
        })
      }
      return NextResponse.json({ success: true })
    }

    // 5. คำนวณและจัดสรรสล็อต 4 ช่องต่อหน้า (Run Slot Allocation Engine)
    if (action === "run_allocation") {
      const { event_name, session_date } = body
      if (!event_name || !session_date) {
        return NextResponse.json({ error: "กรุณาระบุชื่ออีเวนต์และวันที่" }, { status: 400 })
      }

      const { data: sessions } = await supabase
        .from("event_sessions")
        .select("*")
        .eq("event_name", event_name)
        .eq("session_date", session_date)
        .eq("status", "active")

      if (!sessions || sessions.length === 0) {
        return NextResponse.json({ error: "ยังไม่ได้ตั้งค่าจำนวนไอเทมของอีเวนต์นี้" }, { status: 400 })
      }

      const { data: attendees } = await supabase
        .from("event_attendance")
        .select("discord_id, user_id, status, interested_items, created_at, profiles:user_id(display_name, discord_id)")
        .eq("event_name", event_name)
        .eq("event_date", session_date)
        .order("created_at", { ascending: true })

      const { data: allCredits } = await supabase.from("carry_credits").select("user_id, item_type, credit")

      const creditLookup: Record<string, number> = {}
      for (const c of allCredits || []) {
        creditLookup[`${c.user_id}|${c.item_type}`] = c.credit || 0
      }

      // ลบสล็อตเดิมของอีเวนต์นี้ก่อนบันทึกใหม่
      await supabase
        .from("allocated_slots")
        .delete()
        .eq("event_name", event_name)
        .eq("session_date", session_date)

      const overallTotalPages = Math.max(...sessions.map((s: any) => Number(s.end_page) || 1), 1)
      const sortedSessions = [...sessions].sort(
        (a: any, b: any) =>
          PRIORITY_ORDER.indexOf(a.item_type as any) - PRIORITY_ORDER.indexOf(b.item_type as any)
      )

      const rowsToInsert: any[] = []

      for (const sess of sortedSessions) {
        const itemType = sess.item_type
        const totalQty = Number(sess.total_quantity) || 0
        const personalLimit = Math.max(1, Number(sess.personal_limit) || 1)
        const startPage = Math.max(1, Number(sess.start_page) || 1)
        const startSlot = Math.min(4, Math.max(1, Number(sess.start_slot) || 1))

        if (totalQty <= 0) continue

        // คัดกรองคนที่เลือก want_bid และติ๊กเลือกไอเทมนี้
        const interested = (attendees || []).filter(
          (a: any) =>
            a.status === "want_bid" &&
            a.user_id &&
            Array.isArray(a.interested_items) &&
            a.interested_items.includes(itemType)
        )

        if (interested.length === 0) continue

        // เรียงตาม Carry Credit มากก่อน -> เวลาลงชื่อก่อน
        const sortedMembers = [...interested].sort((a: any, b: any) => {
          const credA = creditLookup[`${a.user_id}|${itemType}`] || 0
          const credB = creditLookup[`${b.user_id}|${itemType}`] || 0
          if (credB !== credA) return credB - credA
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        })

        const n = sortedMembers.length
        const baseShare = Math.min(Math.floor(totalQty / n), personalLimit)
        const allocMap: Record<string, number> = {}
        for (const m of sortedMembers) {
          allocMap[m.user_id] = baseShare
        }

        let remaining = totalQty - baseShare * n
        for (const m of sortedMembers) {
          if (remaining <= 0) break
          if (allocMap[m.user_id] < personalLimit) {
            allocMap[m.user_id] += 1
            remaining -= 1
          }
        }

        let curPage = startPage
        let curSlot = startSlot

        for (const m of sortedMembers) {
          const qty = allocMap[m.user_id] || 0
          for (let i = 0; i < qty; i++) {
            rowsToInsert.push({
              event_name,
              session_date,
              user_id: m.user_id,
              item_type: itemType,
              page_number: curPage,
              slot_number: curSlot,
              total_pages: Math.max(overallTotalPages, curPage),
              status: "allocated",
            })
            curSlot += 1
            if (curSlot > 4) {
              curSlot = 1
              curPage += 1
            }
          }
        }
      }

      if (rowsToInsert.length > 0) {
        const maxPageUsed = Math.max(...rowsToInsert.map((r) => r.page_number), overallTotalPages)
        for (const r of rowsToInsert) {
          r.total_pages = maxPageUsed
        }
        const { error: insErr } = await supabase.from("allocated_slots").insert(rowsToInsert)
        if (insErr) throw insErr
      }

      return NextResponse.json({ success: true, allocated_count: rowsToInsert.length })
    }

    // 6. อัปเดตสถานะสล็อต (Awarded / Skipped / Allocated)
    if (action === "update_slot_status") {
      const { slot_ids, status } = body
      if (!Array.isArray(slot_ids) || slot_ids.length === 0) {
        return NextResponse.json({ error: "ไม่ได้เลือกสล็อต" }, { status: 400 })
      }

      const { data: targetSlots } = await supabase
        .from("allocated_slots")
        .select("*")
        .in("id", slot_ids)

      const { error } = await supabase
        .from("allocated_slots")
        .update({ status })
        .in("id", slot_ids)

      if (error) throw error

      // ถ้ากดมอบของ (awarded) ให้บันทึกประวัติลง auction_history ด้วย
      if (status === "awarded" && targetSlots && targetSlots.length > 0) {
        const historyRows = targetSlots
          .filter((s: any) => s.status !== "awarded" && s.user_id)
          .map((s: any) => ({
            user_id: s.user_id,
            item_type: s.item_type,
            qty_awarded: 1,
            note: `${s.event_name} (${s.session_date}) - Page ${s.page_number}/${s.total_pages} Slot ${s.slot_number}`,
            awarded_at: new Date().toISOString(),
          }))
        if (historyRows.length > 0) {
          await supabase.from("auction_history").insert(historyRows)
        }
      }

      return NextResponse.json({ success: true })
    }

    // 7. ลบรอบกิจกรรมทั้งหมด (ลบทั้ง allocated_slots, event_attendance, event_sessions)
    if (action === "delete_event") {
      const { event_name, session_date } = body
      if (!event_name || !session_date) {
        return NextResponse.json({ error: "กรุณาระบุรอบที่ต้องการลบ" }, { status: 400 })
      }

      await supabase.from("allocated_slots").delete().eq("event_name", event_name).eq("session_date", session_date)
      await supabase.from("event_attendance").delete().eq("event_name", event_name).eq("event_date", session_date)
      await supabase.from("event_sessions").delete().eq("event_name", event_name).eq("session_date", session_date)

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 })
  }
}

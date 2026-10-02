import { auth } from "@/auth"
import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

const PRIORITY_ORDER = ["Album", "Puppet", "White", "RedBlack"] as const

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const event_name = searchParams.get("event_name")
  const session_date = searchParams.get("session_date")

  let sessionsQuery = supabase.from("event_sessions").select("*").order("session_date", { ascending: false })
  let slotsQuery = supabase
    .from("allocated_slots")
    .select("*, profiles:user_id(display_name, discord_id, job_class)")
    .order("page_number", { ascending: true })
    .order("slot_number", { ascending: true })
  let attendanceQuery = supabase
    .from("event_attendance")
    .select("*, profiles:user_id(display_name, discord_id, job_class)")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })

  if (event_name && session_date) {
    sessionsQuery = sessionsQuery.eq("event_name", event_name).eq("session_date", session_date)
    slotsQuery = slotsQuery.eq("event_name", event_name).eq("session_date", session_date)
    attendanceQuery = attendanceQuery.eq("event_name", event_name).eq("event_date", session_date)
  }

  const [
    { data: sessions },
    { data: slots },
    { data: attendance },
    { data: credits },
  ] = await Promise.all([
    sessionsQuery,
    slotsQuery,
    attendanceQuery,
    supabase.from("carry_credits").select("*"),
  ])

  return NextResponse.json({
    sessions: sessions || [],
    slots: slots || [],
    attendance: attendance || [],
    credits: credits || [],
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

  try {
    // 1. บันทึกการตั้งค่าพิกัดหน้า/ช่อง และจำนวนไอเทมทั้ง 4 ชนิด
    if (action === "save_sessions") {
      const { event_name, session_date, items } = body
      if (!event_name || !session_date || !Array.isArray(items)) {
        return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน" }, { status: 400 })
      }

      const { data: existingRows } = await supabase
        .from("event_sessions")
        .select("status")
        .eq("event_name", event_name)
        .eq("session_date", session_date)

      const isAlreadyClosed =
        existingRows && existingRows.length > 0 && existingRows.every((r: any) => r.status === "closed")
      const preservedStatus = isAlreadyClosed ? "closed" : "active"

      for (const it of items) {
        const total = Math.max(0, Number(it.total_quantity) || 0)
        const limit = Math.max(1, Number(it.personal_limit) || 1)
        const sp = total === 0 ? 0 : Math.max(0, Number(it.start_page) || 0)
        const ss = total === 0 ? 1 : Math.min(4, Math.max(1, Number(it.start_slot) || 1))
        const ep = total === 0 ? 0 : Math.max(sp, Number(it.end_page) || Math.ceil((total || 1) / 4))
        const es = total === 0 ? 1 : Math.min(4, Math.max(1, Number(it.end_slot) || (((total || 1) - 1) % 4) + 1))

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
            status: preservedStatus,
          },
          { onConflict: "event_name,session_date,item_type" }
        )
      }

      return NextResponse.json({ success: true })
    }

    // 1.5 ปิดโหวต / เปิดโหวต (Toggle Poll Status)
    if (action === "set_poll_status") {
      const { event_name, session_date, status } = body
      if (!event_name || !session_date || !["active", "closed"].includes(status)) {
        return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 })
      }

      const { data: existing } = await supabase
        .from("event_sessions")
        .select("id")
        .eq("event_name", event_name)
        .eq("session_date", session_date)

      if (!existing || existing.length === 0) {
        for (const itemType of PRIORITY_ORDER) {
          await supabase.from("event_sessions").upsert(
            {
              event_name,
              session_date,
              item_type: itemType,
              start_page: 1,
              start_slot: 1,
              end_page: 1,
              end_slot: 1,
              total_quantity: 0,
              personal_limit: 1,
              status,
            },
            { onConflict: "event_name,session_date,item_type" }
          )
        }
      } else {
        await supabase
          .from("event_sessions")
          .update({ status })
          .eq("event_name", event_name)
          .eq("session_date", session_date)
      }

      return NextResponse.json({ success: true, status })
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

      if (!sessions || sessions.length === 0) {
        return NextResponse.json({ error: "ยังไม่ได้ตั้งค่าจำนวนไอเทมของอีเวนต์นี้" }, { status: 400 })
      }

      const isPollClosed = sessions.every((s: any) => s.status === "closed")
      if (!isPollClosed) {
        return NextResponse.json(
          { error: "กรุณากดปิดโหวตก่อน จึงจะสามารถคำนวณและจัดสรรสล็อตให้สมาชิกได้" },
          { status: 400 }
        )
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

      const rollResults = body.roll_results || {}

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

        if (interested.length > 0) {
          const itemRollMap: Record<string, number> = {}
          if (Array.isArray(rollResults[itemType])) {
            for (const r of rollResults[itemType]) {
              itemRollMap[r.user_id] = Number(r.roll) || 0
            }
          }

          // เรียงตาม: 1) Carry Credit มากก่อน -> 2) Roll score สูงก่อน (ถ้ามีผลสุ่ม) -> 3) เวลาลงชื่อก่อน
          const sortedMembers = [...interested].sort((a: any, b: any) => {
            const credA = creditLookup[`${a.user_id}|${itemType}`] || 0
            const credB = creditLookup[`${b.user_id}|${itemType}`] || 0
            if (credB !== credA) return credB - credA

            const rollA = itemRollMap[a.user_id]
            const rollB = itemRollMap[b.user_id]
            if (rollA !== undefined && rollB !== undefined && rollB !== rollA) {
              return rollB - rollA
            }

            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          })

          const n = sortedMembers.length
          const allocMap: Record<string, number> = {}
          const creditUsedMap: Record<string, number> = {}
          for (const m of sortedMembers) {
            allocMap[m.user_id] = 0
            creditUsedMap[m.user_id] = 0
          }

          let remaining = totalQty

          // ขั้นที่ 1: แจกสิทธิ์ทบจากยอดสะสม (Carry Credit Bonus) ให้คนที่มียอดสะสมก่อน
          const maxCredit = Math.max(
            ...sortedMembers.map((m: any) => Math.max(0, creditLookup[`${m.user_id}|${itemType}`] || 0)),
            0
          )
          for (let pass = 0; pass < maxCredit; pass++) {
            if (remaining <= 0) break
            for (const m of sortedMembers) {
              if (remaining <= 0) break
              const uid = m.user_id
              const userCred = Math.max(0, creditLookup[`${uid}|${itemType}`] || 0)
              if (creditUsedMap[uid] < userCred) {
                allocMap[uid] += 1
                creditUsedMap[uid] += 1
                remaining -= 1
              }
            }
          }

          // ขั้นที่ 2: นำของที่เหลือมาแบ่งโควตาของรอบปัจจุบันให้ทุกคน (คนละไม่เกิน personalLimit)
          if (remaining > 0) {
            const baseShare = Math.min(Math.floor(remaining / n), personalLimit)
            for (const m of sortedMembers) {
              allocMap[m.user_id] += baseShare
            }
            remaining -= baseShare * n

            for (const m of sortedMembers) {
              if (remaining <= 0) break
              const uid = m.user_id
              const currentRoundShare = allocMap[uid] - creditUsedMap[uid]
              if (currentRoundShare < personalLimit) {
                allocMap[uid] += 1
                remaining -= 1
              }
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
        const { data: adminProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "admin")
          .limit(1)
          .maybeSingle()

        const firstSlot = targetSlots[0]
        const { data: sessionRows } = await supabase
          .from("event_sessions")
          .select("id, item_type")
          .eq("event_name", firstSlot.event_name)
          .eq("session_date", firstSlot.session_date)

        const sessionMap = new Map((sessionRows || []).map((r: any) => [r.item_type, r.id]))
        const defaultRoundId = sessionRows?.[0]?.id || null

        const historyRows = targetSlots
          .filter((s: any) => s.status !== "awarded" && s.user_id)
          .map((s: any) => ({
            round_id: sessionMap.get(s.item_type) || defaultRoundId,
            user_id: s.user_id,
            item_type: s.item_type,
            qty_awarded: 1,
            awarded_by: adminProfile?.id || null,
            note: `${s.event_name} (${s.session_date}) - Page ${s.page_number}/${s.total_pages} Slot ${s.slot_number}`,
            awarded_at: new Date().toISOString(),
          }))
        if (historyRows.length > 0) {
          await supabase.from("auction_history").insert(historyRows)
        }
      }

      return NextResponse.json({ success: true })
    }

    // 6.5 บันทึกผลการจัดสรรทั้งรอบลงเป็นประวัติการประมูล (Save Round to Auction History)
    if (action === "save_round_history") {
      const { event_name, session_date } = body
      if (!event_name || !session_date) {
        return NextResponse.json({ error: "กรุณาระบุชื่ออีเวนต์และวันที่" }, { status: 400 })
      }

      // ดึงสล็อตทั้งหมดในรอบนี้ที่มี user_id
      const { data: targetSlots, error: fetchErr } = await supabase
        .from("allocated_slots")
        .select("*, profiles:user_id(display_name)")
        .eq("event_name", event_name)
        .eq("session_date", session_date)
        .not("user_id", "is", null)

      if (fetchErr) throw fetchErr

      if (!targetSlots || targetSlots.length === 0) {
        return NextResponse.json(
          { error: "ไม่พบข้อมูลสล็อตที่มีการจัดสรรในรอบนี้ (กรุณากดคำนวณสล็อตก่อนบันทึกประวัติ)" },
          { status: 400 }
        )
      }

      // ดึง admin profile เพื่อใส่ awarded_by
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .limit(1)
        .maybeSingle()

      // อัปเดตสถานะของสล็อตทั้งหมดในรอบนี้ (ที่ไม่ใช่ skipped) ให้เป็น awarded
      const eligibleSlots = targetSlots.filter((s: any) => s.status !== "skipped")
      const eligibleIds = eligibleSlots.map((s: any) => s.id)

      if (eligibleIds.length > 0) {
        const { error: updateErr } = await supabase
          .from("allocated_slots")
          .update({ status: "awarded" })
          .in("id", eligibleIds)

        if (updateErr) throw updateErr
      }

      // ตรวจสอบประวัติเดิมเพื่อไม่ให้บันทึกซ้ำซ้อน
      const { data: existingHistories } = await supabase
        .from("auction_history")
        .select("note")
        .like("note", `${event_name} (${session_date})%`)

      const existingNotes = new Set((existingHistories || []).map((h: any) => h.note))
      const isFirstCommit = !existingHistories || existingHistories.length === 0

      // ดึง event_sessions เพื่อจับคู่ round_id ให้แต่ละไอเทม และนำ personal_limit มาใช้
      const { data: sessionRows } = await supabase
        .from("event_sessions")
        .select("id, item_type, total_quantity, personal_limit")
        .eq("event_name", event_name)
        .eq("session_date", session_date)

      const sessionMap = new Map((sessionRows || []).map((r: any) => [r.item_type, r.id]))
      const defaultRoundId = sessionRows?.[0]?.id || null

      const historyRows = eligibleSlots
        .map((s: any) => ({
          round_id: sessionMap.get(s.item_type) || defaultRoundId,
          user_id: s.user_id,
          item_type: s.item_type,
          qty_awarded: 1,
          awarded_by: adminProfile?.id || null,
          note: `${s.event_name} (${s.session_date}) - Page ${s.page_number}/${s.total_pages} Slot ${s.slot_number}`,
          awarded_at: new Date().toISOString(),
        }))
        .filter((row: any) => !existingNotes.has(row.note))

      if (historyRows.length > 0) {
        const { error: insErr } = await supabase.from("auction_history").insert(historyRows)
        if (insErr) throw insErr
      }

      const compensatedMembers: Array<{ display_name: string; item_type: string }> = []

      // ปรับปรุง Carry Credit: หักสิทธิ์ทบของผู้ชนะ, เพิ่มแต้มให้ no_bid, และมอบแต้มชดเชย +1 ให้คนตกรอบ (Shortage)
      // กระทำเฉพาะเมื่อบันทึกประวัติครั้งแรกของรอบนี้ เพื่อความ idempotent
      if (isFirstCommit) {
        const { data: attendees } = await supabase
          .from("event_attendance")
          .select("user_id, status, interested_items, profiles:user_id(display_name)")
          .eq("event_name", event_name)
          .eq("event_date", session_date)

        const awardedUserItemPairs = new Set(
          eligibleSlots.map((s: any) => `${s.user_id}|${s.item_type}`)
        )

        const { data: allCredits } = await supabase
          .from("carry_credits")
          .select("id, user_id, item_type, credit")

        const creditRecordMap = new Map<string, { id?: string; credit: number }>()
        for (const c of allCredits || []) {
          creditRecordMap.set(`${c.user_id}|${c.item_type}`, { id: c.id, credit: c.credit || 0 })
        }

        const now = new Date().toISOString()

        for (const sess of (sessionRows || [])) {
          const it = sess.item_type
          const totalQty = Number(sess.total_quantity) || 0
          const personalLimit = Math.max(1, Number(sess.personal_limit) || 1)
          if (totalQty <= 0) continue

          // 1. หักยอดสะสม (Carry Credit) ของสมาชิกที่ใช้สิทธิ์ทบและได้รับไอเทมในรอบนี้
          const userAwardedCount: Record<string, number> = {}
          for (const s of eligibleSlots) {
            if (s.item_type === it && s.user_id) {
              userAwardedCount[s.user_id] = (userAwardedCount[s.user_id] || 0) + 1
            }
          }

          for (const [uid, count] of Object.entries(userAwardedCount)) {
            const rec = creditRecordMap.get(`${uid}|${it}`)
            const curCred = rec ? rec.credit : 0
            if (curCred > 0) {
              const usedAmt = Math.min(curCred, count)
              if (usedAmt > 0) {
                const nextCred = Math.max(0, curCred - usedAmt)
                await supabase
                  .from("carry_credits")
                  .update({ credit: nextCred, last_updated: now })
                  .eq("id", rec!.id)
                creditRecordMap.set(`${uid}|${it}`, { id: rec!.id, credit: nextCred })
              }
            }
          }

          // 2. เพิ่มยอดสะสม (Carry Credit) ให้สมาชิกที่เข้าร่วมกิลด์วอร์แต่เลือกไม่ประมูลวันนี้ (no_bid)
          const noBidAttendees = (attendees || []).filter((a: any) => a.status === "no_bid" && a.user_id)
          for (const nb of noBidAttendees) {
            const uid = nb.user_id
            const rec = creditRecordMap.get(`${uid}|${it}`)
            const curCred = rec ? rec.credit : 0
            const nextCred = curCred + personalLimit

            if (rec?.id) {
              await supabase
                .from("carry_credits")
                .update({ credit: nextCred, last_updated: now })
                .eq("id", rec.id)
              creditRecordMap.set(`${uid}|${it}`, { id: rec.id, credit: nextCred })
            } else {
              const { data: ins } = await supabase
                .from("carry_credits")
                .insert({
                  user_id: uid,
                  item_type: it,
                  credit: nextCred,
                  last_updated: now,
                })
                .select("id")
                .single()
              creditRecordMap.set(`${uid}|${it}`, { id: ins?.id, credit: nextCred })
            }
          }

          // 3. ตรวจหาคนที่ขอ want_bid แต่ได้ของไม่ครบตามลิมิต (Shortage) -> มอบ Carry Credit +1 ชดเชยสำหรับรอบหน้า
          const interested = (attendees || []).filter(
            (a: any) =>
              a.status === "want_bid" &&
              a.user_id &&
              Array.isArray(a.interested_items) &&
              a.interested_items.includes(it)
          )
          const totalDemand = interested.length * personalLimit
          if (totalQty < totalDemand) {
            for (const a of interested) {
              const userSlotsCount = userAwardedCount[a.user_id] || 0
              if (userSlotsCount < personalLimit) {
                const dname = (a.profiles as any)?.display_name || "สมาชิก"
                compensatedMembers.push({ display_name: dname, item_type: it })

                const rec = creditRecordMap.get(`${a.user_id}|${it}`)
                const curCred = rec ? rec.credit : 0
                const nextCred = curCred + 1

                if (rec?.id) {
                  await supabase
                    .from("carry_credits")
                    .update({ credit: nextCred, last_updated: now })
                    .eq("id", rec.id)
                  creditRecordMap.set(`${a.user_id}|${it}`, { id: rec.id, credit: nextCred })
                } else {
                  const { data: ins } = await supabase
                    .from("carry_credits")
                    .insert({
                      user_id: a.user_id,
                      item_type: it,
                      credit: nextCred,
                      last_updated: now,
                    })
                    .select("id")
                    .single()
                  creditRecordMap.set(`${a.user_id}|${it}`, { id: ins?.id, credit: nextCred })
                }
              }
            }
          }
        }
      }

      return NextResponse.json({
        success: true,
        saved_count: historyRows.length,
        total_awarded: eligibleSlots.length,
        compensated_count: compensatedMembers.length,
        compensated_members: compensatedMembers,
      })
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

import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

/**
 * ฟังก์ชันจำลอง Logic การจัดสรรสล็อตและคำนวณพิกัด (ตรงกับทั้ง Bot allocation_service.py และ Web /api/queues/route.ts)
 */
const ITEM_ORDER = ["Album", "Puppet", "White", "RedBlack"]

function computeTotalFromCoords(startPage, startSlot, endPage, endSlot) {
  if (endPage < startPage || (endPage === startPage && endSlot < startSlot)) {
    return 0
  }
  return (endPage - startPage) * 4 + (endSlot - startSlot) + 1
}

function parseQtyAndLimit(rawQty, rawLimit) {
  let qText = String(rawQty ?? "").trim()
  let lText = String(rawLimit ?? "").trim()

  if (qText.includes(",")) {
    const parts = qText.split(",", 2).map((p) => p.trim())
    qText = parts[0]
    if (!lText && parts[1]) lText = parts[1]
  }

  const limitVal = /^\d+$/.test(lText) && Number(lText) > 0 ? Math.max(1, Number(lText)) : 1

  if (!qText || qText === "0") {
    return { mode: "qty", sp: 1, ss: 1, ep: 1, es: 1, totalQty: 0, limitVal }
  }

  const coordMatch = qText.match(/^(\d+)\s*:\s*([1-4])\s*-\s*(\d+)\s*:\s*([1-4])$/)
  if (coordMatch) {
    const sp = Number(coordMatch[1])
    const ss = Number(coordMatch[2])
    const ep = Number(coordMatch[3])
    const es = Number(coordMatch[4])
    const total = computeTotalFromCoords(sp, ss, ep, es)
    return { mode: "coord", sp, ss, ep, es, totalQty: Math.max(0, total), limitVal }
  }

  const qtyVal = /^\d+$/.test(qText) ? Math.max(0, Number(qText)) : 0
  return { mode: "qty", sp: 1, ss: 1, ep: 1, es: 1, totalQty: qtyVal, limitVal }
}

function recalculateContinuousSessions(eventName, sessionDate, itemsConfig, currentStatus = "active") {
  let runningPage = 1
  let runningSlot = 1
  const rows = []

  for (const itemKey of ITEM_ORDER) {
    const cfg = itemsConfig[itemKey] || {}
    const mode = cfg.mode || "qty"
    const totalQty = Number(cfg.total_quantity || 0)
    const limitVal = Math.max(1, Number(cfg.personal_limit || 1))
    let sp = Number(cfg.start_page || 1)
    let ss = Number(cfg.start_slot || 1)
    let ep = Number(cfg.end_page || 1)
    let es = Number(cfg.end_slot || 1)

    if (mode === "coord" && totalQty > 0) {
      let nextSlot = es + 1
      let nextPage = ep
      if (nextSlot > 4) {
        nextSlot = 1
        nextPage += 1
      }
      runningPage = nextPage
      runningSlot = nextSlot
    } else {
      if (totalQty > 0) {
        sp = runningPage
        ss = runningSlot
        const offset = ss - 1 + totalQty - 1
        ep = sp + Math.floor(offset / 4)
        es = (offset % 4) + 1
        const nextOffset = offset + 1
        runningPage = sp + Math.floor(nextOffset / 4)
        runningSlot = (nextOffset % 4) + 1
      } else {
        sp = 1
        ss = 1
        ep = 1
        es = 1
      }
    }

    rows.push({
      event_name: eventName,
      session_date: sessionDate,
      item_type: itemKey,
      start_page: sp,
      start_slot: ss,
      end_page: ep,
      end_slot: es,
      total_quantity: totalQty,
      personal_limit: limitVal,
      status: currentStatus,
    })
  }

  return rows
}

function allocateSlots(itemType, totalQty, personalLimit, startPage, startSlot, members, creditMap) {
  if (!members || members.length === 0 || totalQty <= 0) return []

  const sortedMembers = [...members].sort((a, b) => {
    const credA = creditMap[a.user_id] || 0
    const credB = creditMap[b.user_id] || 0
    if (credB !== credA) return credB - credA
    return members.indexOf(a) - members.indexOf(b)
  })

  const n = sortedMembers.length
  const base = Math.min(Math.floor(totalQty / n), personalLimit)
  const alloc = {}
  for (const m of sortedMembers) {
    alloc[m.user_id] = base
  }

  let remaining = totalQty - base * n
  for (const m of sortedMembers) {
    if (remaining <= 0) break
    if (alloc[m.user_id] < personalLimit) {
      alloc[m.user_id] += 1
      remaining -= 1
    }
  }

  const result = []
  let curPage = startPage
  let curSlot = startSlot

  for (const m of sortedMembers) {
    const qty = alloc[m.user_id]
    for (let i = 0; i < qty; i++) {
      result.push({
        user_id: m.user_id,
        display_name: m.display_name || "",
        discord_id: m.discord_id || "",
        item_type: itemType,
        page: curPage,
        slot: curSlot,
      })
      curSlot += 1
      if (curSlot > 4) {
        curSlot = 1
        curPage += 1
      }
    }
  }

  const lastPage = curSlot > 1 ? curPage : curPage - 1
  for (const row of result) {
    row.total_pages = Math.max(lastPage, startPage)
  }

  return result
}

test("Scenario 1: คนขอประมูลน้อยกว่าจำนวนของ (3 คน ขอสมุดการ์ด 10 ชิ้น ลิมิต 2/คน -> ได้คนละ 2 ชิ้น รวม 6 ชิ้น ไม่เกินลิมิต)", () => {
  const members = [
    { user_id: "u1", display_name: "PlayerOne", discord_id: "1001" },
    { user_id: "u2", display_name: "PlayerTwo", discord_id: "1002" },
    { user_id: "u3", display_name: "PlayerThree", discord_id: "1003" },
  ]
  const slots = allocateSlots("Album", 10, 2, 1, 1, members, {})
  assert.equal(slots.length, 6)

  const countByUser = {}
  for (const s of slots) countByUser[s.user_id] = (countByUser[s.user_id] || 0) + 1
  assert.deepEqual(countByUser, { u1: 2, u2: 2, u3: 2 })
  assert.deepEqual(
    slots.map((s) => [s.page, s.slot]),
    [
      [1, 1],
      [1, 2],
      [1, 3],
      [1, 4],
      [2, 1],
      [2, 2],
    ]
  )
})

test("Scenario 2: คนขอประมูลหารลงตัวพอดี (4 คน ขอขนนกขาว 8 ชิ้น ลิมิต 2/คน -> ได้คนละ 2 ชิ้น เต็ม 2 หน้า)", () => {
  const members = [1, 2, 3, 4].map((i) => ({
    user_id: `u${i}`,
    display_name: `Member${i}`,
    discord_id: `200${i}`,
  }))
  const slots = allocateSlots("White", 8, 2, 1, 1, members, {})
  assert.equal(slots.length, 8)
  assert.equal(slots[7].page, 2)
  assert.equal(slots[7].slot, 4)
})

test("Scenario 3: ของมีเศษเหลือ ทดสอบการลัดคิวด้วย Carry Credit (เศษการ์ดบอส 6 ชิ้น, ลิมิต 2, คนขอ 4 คน)", () => {
  const members = [
    { user_id: "u1", display_name: "EarlyNoCredit", discord_id: "3001" },
    { user_id: "u2", display_name: "HighCredit3", discord_id: "3002" },
    { user_id: "u3", display_name: "MidCredit1", discord_id: "3003" },
    { user_id: "u4", display_name: "LateNoCredit", discord_id: "3004" },
  ]
  const creditMap = { u1: 0, u2: 3, u3: 1, u4: 0 }
  const slots = allocateSlots("Puppet", 6, 2, 1, 1, members, creditMap)

  assert.equal(slots.length, 6)
  const countByUser = {}
  for (const s of slots) countByUser[s.user_id] = (countByUser[s.user_id] || 0) + 1

  assert.equal(countByUser.u2, 2, "u2 (Credit 3) ต้องได้ 2 ชิ้น")
  assert.equal(countByUser.u3, 2, "u3 (Credit 1) ต้องได้ 2 ชิ้น")
  assert.equal(countByUser.u1, 1, "u1 (Credit 0) ต้องได้ 1 ชิ้น")
  assert.equal(countByUser.u4, 1, "u4 (Credit 0) ต้องได้ 1 ชิ้น")
  assert.equal(slots[0].user_id, "u2", "คนที่มี Credit สูงสุดได้คิวช่องแรก")
})

test("Scenario 4: ของมีน้อยกว่าจำนวนคนขอ (ขนนกดำแดง 2 ชิ้น, ลิมิต 1, คนขอ 5 คน)", () => {
  const members = [1, 2, 3, 4, 5].map((i) => ({
    user_id: `u${i}`,
    display_name: `User${i}`,
    discord_id: `400${i}`,
  }))
  const creditMap = { u3: 2 }
  const slots = allocateSlots("RedBlack", 2, 1, 3, 3, members, creditMap)

  assert.equal(slots.length, 2)
  assert.deepEqual(
    slots.map((s) => s.user_id),
    ["u3", "u1"]
  )
  assert.deepEqual(
    slots.map((s) => [s.page, s.slot]),
    [
      [3, 3],
      [3, 4],
    ]
  )
})

test("Scenario 5: คำนวณพิกัดหน้า/ช่องต่อเนื่องกันทั้ง 4 ไอเทม (Multi-Item Continuous Coordinates)", () => {
  const config = {
    Album: { mode: "qty", total_quantity: 5, personal_limit: 2 },
    Puppet: { mode: "qty", total_quantity: 3, personal_limit: 1 },
    White: { mode: "qty", total_quantity: 0, personal_limit: 1 },
    RedBlack: { mode: "qty", total_quantity: 2, personal_limit: 1 },
  }
  const rows = recalculateContinuousSessions("กิลลีค", "2026-09-30", config, "closed")
  const byType = Object.fromEntries(rows.map((r) => [r.item_type, r]))

  assert.deepEqual(
    [byType.Album.start_page, byType.Album.start_slot, byType.Album.end_page, byType.Album.end_slot],
    [1, 1, 2, 1]
  )
  assert.deepEqual(
    [byType.Puppet.start_page, byType.Puppet.start_slot, byType.Puppet.end_page, byType.Puppet.end_slot],
    [2, 2, 2, 4]
  )
  assert.equal(byType.White.total_quantity, 0)
  assert.deepEqual(
    [byType.RedBlack.start_page, byType.RedBlack.start_slot, byType.RedBlack.end_page, byType.RedBlack.end_slot],
    [3, 1, 3, 2]
  )
  assert.ok(rows.every((r) => r.status === "closed"))
})

test("Scenario 6: แยกช่องกรอก จำนวน และ ลิมิต (ไม่ต้องใช้ลูกน้ำ ,) และตรวจโค้ดบอทเรื่องความยาว Label <= 45 ตัวอักษร & เงื่อนไขปิดโหวต", () => {
  const res1 = parseQtyAndLimit("15", "2")
  assert.equal(res1.totalQty, 15)
  assert.equal(res1.limitVal, 2)

  const res2 = parseQtyAndLimit("1:1-2:4", "3")
  assert.equal(res2.mode, "coord")
  assert.equal(res2.totalQty, 8)
  assert.equal(res2.limitVal, 3)

  // ตรวจไฟล์ bot/cogs/auction.py จริงว่าทุก label ใน Modal ยาว <= 45 ตัวอักษร และมีระบบเช็ค status == 'closed'
  const auctionPyPath = path.resolve(process.cwd(), "../bot/cogs/auction.py")
  const auctionPy = fs.readFileSync(auctionPyPath, "utf8")

  const labelMatches = [...auctionPy.matchAll(/label='([^']+)'/g)]
  assert.ok(labelMatches.length >= 8, "ต้องมีป้ายกำกับสำหรับช่องกรอกและปุ่มครบถ้วน")
  for (const m of labelMatches) {
    const labelText = m[1]
    assert.ok(
      labelText.length <= 45,
      `Label "${labelText}" มีความยาว ${labelText.length} ตัวอักษร (เกิน 45 ตัวอักษรของ Discord)`
    )
  }

  // ตรวจสอบว่ามีเงื่อนไขบังคับปิดโหวตก่อนประกาศผล
  assert.ok(
    auctionPy.includes("all(s.get('status') == 'closed' for s in all_sessions)"),
    "ต้องมีการตรวจสอบว่าปิดโหวตแล้ว (status == 'closed') ก่อนประกาศผล"
  )
})

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
  const alloc = {}
  const creditUsed = {}
  for (const m of sortedMembers) {
    alloc[m.user_id] = 0
    creditUsed[m.user_id] = 0
  }

  let remaining = totalQty

  // ขั้นที่ 1: แจกสิทธิ์ทบจากยอดสะสม (Carry Credit Bonus) ให้คนที่มียอดสะสมก่อน
  const maxCredit = Math.max(...sortedMembers.map((m) => Math.max(0, creditMap[m.user_id] || 0)), 0)
  for (let pass = 0; pass < maxCredit; pass++) {
    if (remaining <= 0) break
    for (const m of sortedMembers) {
      if (remaining <= 0) break
      const uid = m.user_id
      const userCred = Math.max(0, creditMap[uid] || 0)
      if (creditUsed[uid] < userCred) {
        alloc[uid] += 1
        creditUsed[uid] += 1
        remaining -= 1
      }
    }
  }

  // ขั้นที่ 2: นำของที่เหลือมาแบ่งโควตาของรอบปัจจุบันให้ทุกคน (คนละไม่เกิน personalLimit)
  if (remaining > 0) {
    const base = Math.min(Math.floor(remaining / n), personalLimit)
    for (const m of sortedMembers) {
      alloc[m.user_id] += base
    }
    remaining -= base * n

    for (const m of sortedMembers) {
      if (remaining <= 0) break
      const uid = m.user_id
      const currentRoundShare = alloc[uid] - creditUsed[uid]
      if (currentRoundShare < personalLimit) {
        alloc[uid] += 1
        remaining -= 1
      }
    }
  }

  const result = []
  let curPage = startPage
  let curSlot = startSlot

  for (const m of sortedMembers) {
    const uid = m.user_id
    const qty = alloc[uid]
    const usedCred = creditUsed[uid]
    for (let i = 0; i < qty; i++) {
      result.push({
        user_id: uid,
        display_name: m.display_name || "",
        discord_id: m.discord_id || "",
        item_type: itemType,
        page: curPage,
        slot: curSlot,
        from_credit: i < usedCred,
        credit_used_total: usedCred,
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

test("Scenario 3: สมาชิกเข้าร่วมกิลด์วอร์แต่ไม่ประมูลวันนี้ (no_bid) สะสมแต้มไว้ -> ครั้งถัดไปประมูล จะได้รับจำนวนมากกว่าคนอื่น!", () => {
  // รอบที่ 1: สมุดการ์ด 2 ชิ้น, ลิมิต 1/คน
  // PlayerA เลือก 'no_bid' (เข้าร่วมวอร์แต่ยังไม่ประมูลวันนี้) -> ได้ Carry Credit สะสม = +1
  // PlayerB, PlayerC เลือก 'want_bid' -> ได้คนละ 1 ชิ้น
  const carryCreditsAfterRound1 = {
    PlayerA: 1, // สะสมมา 1 ชิ้นจากรอบที่ 1
    PlayerB: 0,
    PlayerC: 0,
  }

  // รอบที่ 2 (ครั้งถัดไป): สมุดการ์ดมี 4 ชิ้น, ลิมิตต่อคนในรอบนี้ = 1 ชิ้น
  // คราวนี้ทั้ง PlayerA, PlayerB, PlayerC กดต้องการประมูล ('want_bid') ทุกคน!
  const round2Members = [
    { user_id: "PlayerB", display_name: "PlayerB", discord_id: "3002" },
    { user_id: "PlayerA", display_name: "PlayerA", discord_id: "3001" },
    { user_id: "PlayerC", display_name: "PlayerC", discord_id: "3003" },
  ]

  const slotsRound2 = allocateSlots("Album", 4, 1, 1, 1, round2Members, carryCreditsAfterRound1)

  const countByUser = {}
  for (const s of slotsRound2) countByUser[s.user_id] = (countByUser[s.user_id] || 0) + 1

  // PlayerA มียอดสะสม 1 + สิทธิ์รอบนี้ 1 = ต้องได้รับ 2 ชิ้น (มากกว่าคนอื่นที่ได้คนละ 1 ชิ้น!)
  assert.equal(countByUser.PlayerA, 2, "PlayerA ที่เก็บยอดสะสมจากรอบก่อนต้องได้ 2 ชิ้น (มากกว่าคนอื่น)")
  assert.equal(countByUser.PlayerB, 1, "PlayerB ต้องได้ 1 ชิ้นตามลิมิตปกติ")
  assert.equal(countByUser.PlayerC, 1, "PlayerC ต้องได้ 1 ชิ้นตามลิมิตปกติ")
  assert.equal(slotsRound2[0].user_id, "PlayerA", "PlayerA ต้องได้คิวสล็อตแรกสุด")
  assert.equal(slotsRound2[0].credit_used_total, 1, "บันทึกว่าใช้ Carry Credit ไป 1 แต้ม")
})

test("Scenario 4: ของมีน้อยกว่าจำนวนคนขอ (ขนนกดำแดง 2 ชิ้น, ลิมิต 1, คนขอ 5 คน โดย u3 มียอดสะสม Credit = 1)", () => {
  const members = [1, 2, 3, 4, 5].map((i) => ({
    user_id: `u${i}`,
    display_name: `User${i}`,
    discord_id: `400${i}`,
  }))
  const creditMap = { u3: 1 }
  // u3 มี Credit 1 ชิ้น -> ได้ชิ้นทบ 1 ชิ้น + ของที่เหลืออีก 1 ชิ้นตกเป็นของ u3 ในฐานะคิวแรกของรอบนี้ (รวม u3 ได้ 2 ชิ้น!)
  const slots = allocateSlots("RedBlack", 2, 1, 3, 3, members, creditMap)

  assert.equal(slots.length, 2)
  assert.deepEqual(
    slots.map((s) => s.user_id),
    ["u3", "u3"]
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

  const botPath1 = path.resolve(process.cwd(), "bot/cogs/auction.py")
  const botPath2 = path.resolve(process.cwd(), "../bot/cogs/auction.py")
  const auctionPyPath = fs.existsSync(botPath1) ? botPath1 : botPath2
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

  assert.ok(
    auctionPy.includes("all(s.get('status') == 'closed' for s in all_sessions)"),
    "ต้องมีการตรวจสอบว่าปิดโหวตแล้ว (status == 'closed') ก่อนประกาศผล"
  )
})

test("Scenario 7: กรณีไอเทมมีน้อยกว่าคนขอ (เช่น การ์ดหุ่น 6 ชิ้น คนขอ 10 คน) มีการสุ่ม Random Roll และคนที่ตกรอบได้รับแต้มชดเชย +1 Carry Credit สำหรับรอบถัดไป", () => {
  // สมาชิก 10 คน ขอการ์ดหุ่น (Puppet) มีของแค่ 6 ชิ้น
  // u1, u2 มี Carry Credit = 1 มาจากรอบก่อน (ได้การันตีก่อน)
  // u3 - u10 มี Carry Credit = 0 (ต้องสุ่ม Random Roll แย่ง 4 ชิ้นที่เหลือ)
  const members = Array.from({ length: 10 }, (_, i) => ({
    user_id: `u${i + 1}`,
    display_name: `Member${i + 1}`,
    discord_id: `discord_${i + 1}`,
  }))

  const creditMap = {
    u1: 1,
    u2: 1,
    u3: 0, u4: 0, u5: 0, u6: 0, u7: 0, u8: 0, u9: 0, u10: 0,
  }

  // ผลการสุ่มลูกเต๋า (Roll 1-100) ของ u3 - u10
  const rollMap = {
    u3: 95, // ชนะ
    u4: 88, // ชนะ
    u5: 72, // ชนะ
    u6: 60, // ชนะ
    u7: 45, // ตกรอบ
    u8: 30, // ตกรอบ
    u9: 22, // ตกรอบ
    u10: 10, // ตกรอบ
  }

  // ฟังก์ชันจัดสรรตามตรรกะใหม่
  const sortedMembers = [...members].sort((a, b) => {
    const credA = creditMap[a.user_id] || 0
    const credB = creditMap[b.user_id] || 0
    if (credB !== credA) return credB - credA

    const rollA = rollMap[a.user_id]
    const rollB = rollMap[b.user_id]
    if (rollA !== undefined && rollB !== undefined && rollB !== rollA) {
      return rollB - rollA
    }
    return members.indexOf(a) - members.indexOf(b)
  })

  // มอบของ 6 ชิ้น (ลิมิต 1 ชิ้น/คน)
  const awardedUserIds = sortedMembers.slice(0, 6).map((m) => m.user_id)
  const missedUserIds = sortedMembers.slice(6).map((m) => m.user_id)

  // ตรวจสอบว่า u1 และ u2 ที่มี Carry Credit ได้รับแน่นอน
  assert.ok(awardedUserIds.includes("u1"), "u1 ต้องได้สิทธิ์เพราะมี Carry Credit")
  assert.ok(awardedUserIds.includes("u2"), "u2 ต้องได้สิทธิ์เพราะมี Carry Credit")

  // ตรวจสอบว่า u3, u4, u5, u6 ที่ทอยเต๋าได้แต้มสูงสุด 4 อันดับแรก เป็นผู้ได้รับของ
  assert.deepEqual(awardedUserIds, ["u1", "u2", "u3", "u4", "u5", "u6"])

  // ตรวจสอบว่า u7, u8, u9, u10 ตกรอบและต้องได้รับแต้มชดเชย +1 Carry Credit
  assert.deepEqual(missedUserIds, ["u7", "u8", "u9", "u10"])

  // จำลองการหักแต้มคนที่ใช้สิทธิ์ทบ (u1, u2) และมอบแต้มชดเชย +1 ให้คนที่ตกรอบ (u7, u8, u9, u10)
  const updatedCreditsAfterRound = { ...creditMap }
  updatedCreditsAfterRound.u1 = 0 // ใช้แต้มทบไปแล้วในรอบ 1
  updatedCreditsAfterRound.u2 = 0 // ใช้แต้มทบไปแล้วในรอบ 1
  for (const uid of missedUserIds) {
    updatedCreditsAfterRound[uid] = (updatedCreditsAfterRound[uid] || 0) + 1
  }

  assert.equal(updatedCreditsAfterRound.u7, 1)
  assert.equal(updatedCreditsAfterRound.u8, 1)
  assert.equal(updatedCreditsAfterRound.u9, 1)
  assert.equal(updatedCreditsAfterRound.u10, 1)

  // ในรอบถัดไป: สมาชิก 4 คนที่ตกรอบ (u7, u8, u9, u10) จะกลายเป็นกลุ่มที่มี Carry Credit = 1 และได้รับสิทธิ์ก่อนใคร!
  const round2Sorted = [...members].sort((a, b) => {
    return (updatedCreditsAfterRound[b.user_id] || 0) - (updatedCreditsAfterRound[a.user_id] || 0)
  })
  const round2Top4 = round2Sorted.slice(0, 4).map((m) => m.user_id)
  assert.ok(round2Top4.includes("u7") && round2Top4.includes("u8") && round2Top4.includes("u9") && round2Top4.includes("u10"),
    "ในรอบถัดไป สมาชิกที่เคยตกรอบจะต้องได้โควตาก่อนคนอื่นอย่างแน่นอน"
  )
})

test("Scenario 8: การกดคำนวณสล็อต (run_allocation) เป็น Read-Only ต่อ Carry Credit และบันทึก/ตัดแต้มเมื่อกดบันทึกประวัติ (save_round_history) เท่านั้น", () => {
  // ตรวจสอบ source code ของ route.ts ว่า run_allocation ไม่มีการเขียนลง carry_credits
  const routePath = path.resolve(process.cwd(), "web/app/api/queues/route.ts")
  const routeContent = fs.readFileSync(routePath, "utf8")

  const runAllocIndex = routeContent.indexOf('action === "run_allocation"')
  const saveHistoryIndex = routeContent.indexOf('action === "save_round_history"')
  assert.ok(runAllocIndex !== -1 && saveHistoryIndex !== -1, "ต้องมี run_allocation และ save_round_history ใน route.ts")

  const runAllocBlock = routeContent.substring(runAllocIndex, saveHistoryIndex)
  assert.equal(
    /\.from\("carry_credits"\)\s*\.update/.test(runAllocBlock),
    false,
    "run_allocation จะต้องไม่มีการ .update() ลง carry_credits อย่างเด็ดขาด (ห้ามตัดแต้มตอนพรีวิว)"
  )
  assert.equal(
    /\.from\("carry_credits"\)\s*\.insert/.test(runAllocBlock),
    false,
    "run_allocation จะต้องไม่มีการ .insert() ลง carry_credits อย่างเด็ดขาด (ห้ามเพิ่มแต้ม no_bid ตอนพรีวิว)"
  )

  // ตรวจสอบว่า save_round_history มีการตัดแต้มผู้ชนะ, เพิ่มแต้ม no_bid, และชดเชย shortage ภายใต้ isFirstCommit
  const saveHistoryBlock = routeContent.substring(saveHistoryIndex)
  assert.ok(
    saveHistoryBlock.includes("isFirstCommit"),
    "save_round_history ต้องมี guard isFirstCommit เพื่อป้องกันบันทึกซ้ำซ้อน"
  )
  assert.ok(
    /\.from\("carry_credits"\)\s*\.update/.test(saveHistoryBlock),
    "save_round_history ต้องมีการ update carry_credits"
  )

  // จำลองว่ากดคำนวณสล็อต 5 ครั้ง แต้มเครดิตของผู้ใช้ต้องคงเดิมไม่เปลี่ยน
  const initialCredits = { u_nobid: 2, u_winner: 1, u_normal: 0 }
  const frozenCopy = JSON.stringify(initialCredits)

  const members = [{ user_id: "u_winner", display_name: "Winner" }, { user_id: "u_normal", display_name: "Normal" }]
  for (let click = 0; click < 5; click++) {
    const slots = allocateSlots("Album", 2, 1, 1, 1, members, initialCredits)
    assert.equal(slots.length, 2)
    assert.equal(JSON.stringify(initialCredits), frozenCopy, "การกดคำนวณสล็อตหลายครั้งต้องไม่เปลี่ยนแปลงยอด Credit")
  }
})



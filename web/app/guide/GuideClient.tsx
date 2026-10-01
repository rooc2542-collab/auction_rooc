"use client"

import { useState } from "react"
import Link from "next/link"

interface Props {
  isAdmin?: boolean
}

type TabKey = "member" | "admin" | "credits" | "faq"

export default function GuideClient({ isAdmin }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("member")
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null)

  const copyToClipboard = (cmd: string) => {
    navigator.clipboard.writeText(cmd)
    setCopiedCmd(cmd)
    setTimeout(() => setCopiedCmd(null), 2000)
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-900 via-zinc-900 to-zinc-950 border border-teal-800/40 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold border border-teal-500/30">
            <span>📚 ศูนย์การเรียนรู้และคู่มือการใช้งาน</span>
            <span>•</span>
            <span>RoOC Geffen</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            คู่มือการใช้งานระบบประมูลและจัดสรรไอเทมกิลด์
          </h1>
          <p className="text-zinc-300 text-sm sm:text-base max-w-3xl leading-relaxed">
            คู่มือฉบับสมบูรณ์สำหรับสมาชิกและแอดมิน เพื่อความเข้าใจตรงกัน โปร่งใส ตรวจสอบได้ 100% 
            ตั้งแต่ขั้นตอนการลงทะเบียนผ่าน Discord จนถึงการคุมกระดานสล็อต 4 ช่องและการรับของในเกม
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            <span className="px-2.5 py-1 rounded-md bg-zinc-800/80 text-zinc-300 text-xs font-mono border border-zinc-700">
              🤖 Discord Bot Integration
            </span>
            <span className="px-2.5 py-1 rounded-md bg-zinc-800/80 text-zinc-300 text-xs font-mono border border-zinc-700">
              📊 4-Slots Grid System
            </span>
            <span className="px-2.5 py-1 rounded-md bg-zinc-800/80 text-zinc-300 text-xs font-mono border border-zinc-700">
              ⭐ Carry Credits System
            </span>
            <span className="px-2.5 py-1 rounded-md bg-zinc-800/80 text-zinc-300 text-xs font-mono border border-zinc-700">
              🔍 100% Audit History
            </span>
          </div>
        </div>
      </div>

      {/* Role Navigation Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-zinc-200 dark:bg-zinc-900/90 rounded-xl border border-zinc-300 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("member")}
          className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "member"
              ? "bg-teal-700 text-white shadow-md"
              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <span>🛡️</span>
          <span>สำหรับสมาชิกกิลด์</span>
        </button>

        <button
          onClick={() => setActiveTab("admin")}
          className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "admin"
              ? "bg-teal-700 text-white shadow-md"
              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <span>👑</span>
          <span>สำหรับหัวกิลด์ &amp; แอดมิน</span>
        </button>

        <button
          onClick={() => setActiveTab("credits")}
          className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "credits"
              ? "bg-teal-700 text-white shadow-md"
              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <span>⭐</span>
          <span>แต้มสะสม &amp; กฎกติกา</span>
        </button>

        <button
          onClick={() => setActiveTab("faq")}
          className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "faq"
              ? "bg-teal-700 text-white shadow-md"
              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <span>❓</span>
          <span>คำถามที่พบบ่อย (FAQ)</span>
        </button>
      </div>

      {/* TAB CONTENT 1: MEMBER GUIDE */}
      {activeTab === "member" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6 shadow-sm">
            <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>🛡️</span>
                <span>4 ขั้นตอนง่ายๆ สำหรับสมาชิกกิลด์</span>
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                ทำตาม 4 สเต็ปนี้ เพื่อสิทธิ์การประมูลที่ถูกต้องและไม่พลาดแต้มสะสม
              </p>
            </div>

            {/* Step 1 */}
            <div className="flex flex-col md:flex-row gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60">
              <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                1
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base">
                  ลงทะเบียนครั้งแรกผ่าน Discord (ทำครั้งเดียวตลอดชีพ)
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  เมื่อเข้าสู่เซิร์ฟเวอร์ Discord ของกิลด์ ให้ไปที่ห้องบอทแล้วพิมพ์คำสั่ง{" "}
                  <code className="bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-xs font-mono font-bold text-teal-700 dark:text-teal-300">
                    /register
                  </code>{" "}
                  ตามด้วยชื่อตัวละครของคุณในเกม
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <div className="flex items-center gap-2 bg-zinc-900 text-zinc-200 px-3 py-1.5 rounded-lg font-mono text-xs border border-zinc-700">
                    <span>/register display_name:ชื่อตัวละครของคุณ</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard("/register display_name:")}
                    className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-xs font-medium transition-colors cursor-pointer"
                  >
                    {copiedCmd === "/register display_name:" ? "คัดลอกแล้ว! ✓" : "คัดลอกคำสั่ง"}
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col md:flex-row gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60">
              <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                2
              </div>
              <div className="space-y-3 flex-1">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base">
                  กดโหวตก่อนเริ่มกิจกรรมกิลด์วอร์ (Discord Poll)
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  ก่อนเวลากิลด์วอร์ แอดมินจะเปิดโพลนับคนใน Discord ให้สมาชิกคลิกเลือก 1 ใน 3 ปุ่มตามสถานะความพร้อมของคุณ:
                </p>

                {/* Simulated Poll Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-700/60 space-y-1">
                    <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <span>🟢</span>
                      <span>Join the war / Want to bid</span>
                    </div>
                    <div className="text-[12px] text-zinc-300">
                      ลงวอร์ + <strong>ต้องการลุ้นรับของ</strong> รอบนี้
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-700/60 space-y-1">
                    <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <span>🟡</span>
                      <span>Join / Do not want to bid</span>
                    </div>
                    <div className="text-[12px] text-zinc-300">
                      ลงวอร์ + <strong>สละสิทธิ์รับของ</strong> เพื่อสะสมแต้ม Carry Credit ลัดคิวรอบหน้า!
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-700/60 space-y-1">
                    <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                      <span>🔴</span>
                      <span>Unable to attend</span>
                    </div>
                    <div className="text-[12px] text-zinc-300">
                      ติดธุระ / ไม่สามารถเข้าร่วมกิจกรรมได้
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col md:flex-row gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60">
              <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                3
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base">
                  ตรวจสอบลำดับและพิกัดสล็อตบนเว็บไซต์
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  เข้าสู่หน้า{" "}
                  <Link href="/queues" className="text-teal-600 dark:text-teal-400 underline font-semibold">
                    จัดคิวและสล็อต (/queues)
                  </Link>{" "}
                  เพื่อดูว่าคุณได้คิวที่ <strong>Page ไหน ช่องที่เท่าไหร่ (1-4)</strong> โดยระบบจัดสล็อตจะตรงกับหน้าต่างประมูลในเกม Ragnarok Origin ทันที
                </p>
                <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-400">
                  💡 <strong>Tip:</strong> หากเห็นชื่อตัวเองขึ้นแถบสีเหลือง <em>&quot;รอรับของ&quot;</em> ให้เตรียมตัวกดบิดตามช่องที่ระบุไว้ เมื่อประมูลสำเร็จสถานะจะเปลี่ยนเป็นสีเขียว <em>&quot;ได้รับแล้ว&quot;</em>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col md:flex-row gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60">
              <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                4
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base">
                  เช็กแต้มสะสม Carry Credits ของตนเองได้ตลอด 24 ชั่วโมง
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  สมาชิกสามารถตรวจสอบยอดแต้มสะสมที่เคยช่วยกิลด์วอร์ไว้ได้ 2 วิธี:
                </p>
                <div className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                  <div className="flex items-center gap-2">
                    <span>• ใน Discord: พิมพ์คำสั่ง</span>
                    <code className="bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded font-mono font-bold text-teal-700 dark:text-teal-300">
                      /credits
                    </code>
                    <button
                      onClick={() => copyToClipboard("/credits")}
                      className="px-2 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-white text-[11px]"
                    >
                      {copiedCmd === "/credits" ? "✓" : "Copy"}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>• บนหน้าเว็บ: ไปที่เมนู</span>
                    <Link href="/credits" className="text-teal-600 dark:text-teal-400 font-semibold underline">
                      เครดิตสะสม (/credits)
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: ADMIN GUIDE */}
      {activeTab === "admin" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6 shadow-sm">
            <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>👑</span>
                <span>ขั้นตอนการดำเนินการสำหรับหัวกิลด์และแอดมิน</span>
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                Workflow ครบวงจรตั้งแต่ก่อนเริ่มวอร์ ระหว่างประมูล จนถึงการบันทึกประวัติหลังจบงาน
              </p>
            </div>

            {/* Workflow Timeline */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Phase 1 */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-900 text-teal-200 border border-teal-700">
                    Phase 1: ก่อนเริ่มวอร์
                  </span>
                  <span className="text-xs text-zinc-500">Discord</span>
                </div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                  1. เปิดโพลนับคนเข้าร่วม
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-300">
                  พิมพ์คำสั่งในห้องนัดหมาย Discord:
                </p>
                <div className="flex items-center justify-between bg-zinc-900 text-zinc-200 px-3 py-1.5 rounded-lg font-mono text-xs">
                  <span>/start_vote</span>
                  <button
                    onClick={() => copyToClipboard("/start_vote")}
                    className="text-teal-400 hover:text-teal-300"
                  >
                    {copiedCmd === "/start_vote" ? "✓" : "Copy"}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500">
                  บอทจะส่งปุ่มโหวต 3 ปุ่มให้สมาชิกกดลงชื่อตามความพร้อม
                </p>
              </div>

              {/* Phase 2 */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-900 text-blue-200 border border-blue-700">
                    Phase 2: จัดผังคน
                  </span>
                  <span className="text-xs text-zinc-500">Web Dashboard</span>
                </div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                  2. ตรวจสอบที่ Bench Organizer
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-300">
                  เข้าหน้า{" "}
                  <Link href="/bench" className="text-teal-600 dark:text-teal-400 underline font-semibold">
                    Bench Organizer (/bench)
                  </Link>{" "}
                  เพื่อตรวจเช็กรายชื่อคนลงวอร์ สลับตัวสำรอง/ตัวจริง และดูสัดส่วนคนที่ต้องการของ vs สะสมเครดิต
                </p>
              </div>

              {/* Phase 3 */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-900 text-purple-200 border border-purple-700">
                    Phase 3: ตั้งค่าไอเทม
                  </span>
                  <span className="text-xs text-zinc-500">Web Dashboard</span>
                </div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                  3. กำหนดไอเทม &amp; จัดสรรสล็อตอัตโนมัติ
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-300">
                  ไปที่หน้า{" "}
                  <Link href="/queues" className="text-teal-600 dark:text-teal-400 underline font-semibold">
                    จัดคิวและสล็อต
                  </Link>{" "}
                  -&gt; แท็บ <strong>ตั้งค่า</strong>:
                </p>
                <ul className="text-[12px] text-zinc-600 dark:text-zinc-300 space-y-1 list-disc list-inside">
                  <li>ใส่จำนวนชิ้นของไอเทม: สมุดการ์ด, เศษบอส, ขนขาว, ขนดำแดง</li>
                  <li>ระบบมี <strong>Auto-link Coordinates</strong> คำนวณพิกัดหน้า/ช่องต่อเนื่องให้อัตโนมัติ</li>
                  <li>กดปุ่ม <strong>&quot;จัดสรรสล็อตอัตโนมัติ&quot;</strong> ระบบจะเรียงคิวตาม Carry Credit ทันที</li>
                </ul>
              </div>

              {/* Phase 4 */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-900 text-amber-200 border border-amber-700">
                    Phase 4: ระหว่างประมูล
                  </span>
                  <span className="text-xs text-zinc-500">กระดานสด 4 ช่อง</span>
                </div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                  4. ควบคุมหน้าต่างกระดานสล็อตสด
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-300">
                  สลับไปแท็บ <strong>กระดานสล็อต</strong>:
                </p>
                <ul className="text-[12px] text-zinc-600 dark:text-zinc-300 space-y-1 list-disc list-inside">
                  <li><strong>กดมอบรางวัล (Award):</strong> เมื่อของตกถึงสมาชิก กดแจกทีละช่อง หรือติ๊กหลายช่องแจกทีเดียว</li>
                  <li><strong>กดข้ามคิว (Skip):</strong> หากสมาชิกไม่อยู่ในเวลาประมูล</li>
                  <li><strong>Export ภาพกระดาน:</strong> แคปเจอร์ภาพผังสล็อตส่งลง LINE/Discord ได้ทันที</li>
                </ul>
              </div>
            </div>

            {/* Admin Discord Commands Cheat Sheet */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-3">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                ⚡ สรุปคำสั่งบอท Discord สำหรับแอดมิน
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-between">
                  <div>
                    <span className="text-teal-600 dark:text-teal-400 font-bold">/start_vote</span>
                    <span className="block text-[11px] text-zinc-500 font-sans">เปิดโพลลงชื่อเข้าร่วมวอร์</span>
                  </div>
                  <button onClick={() => copyToClipboard("/start_vote")} className="px-2 py-1 bg-zinc-700 text-white rounded text-[10px]">Copy</button>
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-between">
                  <div>
                    <span className="text-teal-600 dark:text-teal-400 font-bold">/close_vote</span>
                    <span className="block text-[11px] text-zinc-500 font-sans">ปิดโพลและเข้าสู่ช่วงคิว</span>
                  </div>
                  <button onClick={() => copyToClipboard("/close_vote")} className="px-2 py-1 bg-zinc-700 text-white rounded text-[10px]">Copy</button>
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-between">
                  <div>
                    <span className="text-teal-600 dark:text-teal-400 font-bold">/award @user item_type</span>
                    <span className="block text-[11px] text-zinc-500 font-sans">บันทึกแจกของผ่าน Discord</span>
                  </div>
                  <button onClick={() => copyToClipboard("/award")} className="px-2 py-1 bg-zinc-700 text-white rounded text-[10px]">Copy</button>
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-between">
                  <div>
                    <span className="text-teal-600 dark:text-teal-400 font-bold">/round_status</span>
                    <span className="block text-[11px] text-zinc-500 font-sans">เช็กสถานะรอบปัจจุบัน</span>
                  </div>
                  <button onClick={() => copyToClipboard("/round_status")} className="px-2 py-1 bg-zinc-700 text-white rounded text-[10px]">Copy</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: CARRY CREDITS & RULES */}
      {activeTab === "credits" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6 shadow-sm">
            <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>⭐</span>
                <span>กลไก Carry Credits (แต้มสะสมความทุ่มเท)</span>
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                ระบบที่ออกแบบมาเพื่อให้คนช่วยกิลด์วอร์สม่ำเสมอได้รับรางวัลอย่างคุ้มค่าและยุติธรรมที่สุด
              </p>
            </div>

            {/* Core Principle */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-2">
                <div className="text-2xl">🤝</div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                  1. ยิ่งช่วยวอร์ ยิ่งได้แต้ม
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  เมื่อสมาชิกเลือก <strong>&quot;Join the war / Do not want to bid&quot;</strong> จะได้รับ <strong>+1 Credit</strong> ในไอเทมประเภทนั้น สะสมไว้ในบัญชีของคุณทันที
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-2">
                <div className="text-2xl">🚀</div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                  2. สิทธิ์ลัดคิวในรอบที่ต้องการ
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  ในรอบที่คุณตัดสินใจเลือก <strong>&quot;Want to bid&quot;</strong> ระบบ Auto-allocate จะจัดอันดับให้คนที่ <strong>มีแต้ม Credit สูงสุดขึ้นรับของก่อน</strong>
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-2">
                <div className="text-2xl">⚖️</div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                  3. ตัดแต้มเมื่อได้รับของ
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  เมื่อคุณได้รับของรางวัลจากกระดานประมูลสำเร็จ แต้ม Credit ของไอเทมนั้นจะถูกหักออก เพื่อเปิดโอกาสให้เพื่อนสมาชิกท่านอื่นขึ้นมารับต่อในรอบต่อไป
                </p>
              </div>
            </div>

            {/* 4 Items Meta */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-3">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                📦 ไอเทมกิลด์หลัก 4 ประเภทในระบบ
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-800/50 space-y-1">
                  <div className="font-bold text-purple-400">สมุดการ์ด (Album)</div>
                  <div className="text-zinc-400 text-[11px]">สมุดเลือกการ์ดส้ม / การ์ดบอสปลอม</div>
                </div>

                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/50 space-y-1">
                  <div className="font-bold text-amber-400">เศษการ์ดบอส (Puppet)</div>
                  <div className="text-zinc-400 text-[11px]">เศษการ์ดบอสปลอมสำหรับสะสม</div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/60 space-y-1">
                  <div className="font-bold text-zinc-300">ขนนกขาว (White)</div>
                  <div className="text-zinc-400 text-[11px]">ขนนกขาวเกรดอัปเกรดสเตตัส</div>
                </div>

                <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-800/50 space-y-1">
                  <div className="font-bold text-rose-400">ขนนกดำแดง (RedBlack)</div>
                  <div className="text-zinc-400 text-[11px]">ขนนกแดง/ดำสเตตัสขั้นสูง</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: FAQ */}
      {activeTab === "faq" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-5 shadow-sm">
            <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>❓</span>
                <span>คำถามที่พบบ่อย (Frequently Asked Questions)</span>
              </h2>
            </div>

            <div className="space-y-4 text-sm">
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-1.5">
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100">
                  Q: ลืมกดโหวตใน Discord ก่อนเริ่มวอร์ สามารถขอรับของได้ไหม?
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  A: หากลืมโหวต แอดมินสามารถเข้าไปที่หน้าจัดคิว แล้วใช้ฟังก์ชัน <strong>&quot;จองแทนสมาชิก (Proxy Booking)&quot;</strong> หรือเพิ่มชื่อเข้าคิวให้หน้างานได้ แต่แนะนำให้กดโหวตด้วยตนเองเสมอเพื่อรักษาสิทธิ์ความต่อเนื่องของคิวครับ
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-1.5">
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100">
                  Q: พิกัดหน้า/ช่องในระบบตรงกับในเกมอย่างไร?
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  A: ในเกม Ragnarok Origin หน้าต่างประมูลของกิลด์จะแสดงผลหน้าละ 4 ช่อง (ช่อง 1 ถึง 4) ระบบของเราจึงดีไซน์กระดานสล็อตให้ตรงกับ 4 ช่องในเกมแบบ 1:1 แอดมินและสมาชิกจึงสามารถดูพิกัด Page และ Slot Number แล้วบิดของได้ทันทีโดยไม่งง
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-1.5">
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100">
                  Q: ถ้าติดธุระไม่ได้มาบิดของตามเวลา จะเสียสิทธิ์หรือไม่?
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  A: แอดมินสามารถกดปุ่ม <strong>&quot;ข้ามคิว (Skip)&quot;</strong> ให้กับสมาชิกได้ โดยสิทธิ์หรือแต้มจะไม่สูญเปล่า และจะถูกนำไปต่อท้ายหรือจัดสรรให้ในรอบถัดไปตามข้อตกลงของกิลด์ครับ
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-1.5">
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100">
                  Q: สามารถตรวจสอบประวัติการแจกของย้อนหลังได้ที่ไหน?
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  A: ทุกคนสามารถเข้าดูได้ที่หน้า{" "}
                  <Link href="/history" className="text-teal-600 dark:text-teal-400 underline font-semibold">
                    ประวัติการประมูล (/history)
                  </Link>{" "}
                  ซึ่งจะบันทึกทั้ง วันที่, ชื่อผู้รับ, ประเภทไอเทม, จำนวน, และแอดมินผู้มอบรางวัล แบบตรวจสอบได้ 100%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Quick Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <div className="text-xs text-zinc-600 dark:text-zinc-400">
          ต้องการสอบถามข้อมูลเพิ่มเติมหรือแจ้งปัญหา ติดต่อแอดมินกิลด์ได้ใน Discord
        </div>
        <div className="flex gap-2">
          <Link
            href="/queues"
            className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-600 text-white font-semibold text-xs transition-colors"
          >
            ไปยังหน้าจัดคิวและสล็อต →
          </Link>
        </div>
      </div>
    </main>
  )
}

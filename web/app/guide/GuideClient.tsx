"use client"

import { useState } from "react"
import Link from "next/link"

interface Props {
  isAdmin?: boolean
}

type TabKey = "member" | "admin" | "credits" | "pwa" | "faq"

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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-50 via-emerald-50/50 to-white dark:from-teal-950/80 dark:via-zinc-900 dark:to-zinc-950 border border-teal-200/80 dark:border-teal-800/40 p-6 sm:p-8 shadow-sm dark:shadow-xl">
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-800 dark:text-teal-300 text-xs font-semibold border border-teal-300/60 dark:border-teal-500/30">
            <span>📚 ศูนย์การเรียนรู้และคู่มือการใช้งาน</span>
            <span>•</span>
            <span>RoOC Geffen</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            คู่มือการใช้งานระบบประมูลและจัดสรรไอเทมกิลด์
          </h1>
          <p className="text-zinc-600 dark:text-zinc-300 text-sm sm:text-base max-w-3xl leading-relaxed">
            คู่มือฉบับสมบูรณ์สำหรับสมาชิกและแอดมิน เพื่อความเข้าใจตรงกัน โปร่งใส ยุติธรรม ตรวจสอบได้ 100% 
            ครอบคลุมตั้งแต่การลงทะเบียน โหวตจัดคิว สุ่มของขาดแคลน ไปจนถึงการติดตั้งใช้งานบนมือถือ (PWA)
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            <span className="px-2.5 py-1 rounded-md bg-white dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 text-xs font-mono border border-zinc-200 dark:border-zinc-700 shadow-xs">
              🤖 Discord Bot Integration
            </span>
            <span className="px-2.5 py-1 rounded-md bg-white dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 text-xs font-mono border border-zinc-200 dark:border-zinc-700 shadow-xs">
              📊 4-Slots Grid System
            </span>
            <span className="px-2.5 py-1 rounded-md bg-white dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 text-xs font-mono border border-zinc-200 dark:border-zinc-700 shadow-xs">
              ⭐ Carry Credits System
            </span>
            <span className="px-2.5 py-1 rounded-md bg-white dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 text-xs font-mono border border-zinc-200 dark:border-zinc-700 shadow-xs">
              🎲 Random Roll Shortage
            </span>
            <span className="px-2.5 py-1 rounded-md bg-white dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 text-xs font-mono border border-zinc-200 dark:border-zinc-700 shadow-xs">
              📱 Mobile PWA Application
            </span>
          </div>
        </div>
      </div>

      {/* Role Navigation Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-zinc-200 dark:bg-zinc-900/90 rounded-xl border border-zinc-300 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("member")}
          className={`flex-1 min-w-[130px] px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "member"
              ? "bg-teal-700 text-white shadow-md font-bold"
              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <span>🛡️</span>
          <span>สำหรับสมาชิกกิลด์</span>
        </button>

        <button
          onClick={() => setActiveTab("admin")}
          className={`flex-1 min-w-[130px] px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "admin"
              ? "bg-teal-700 text-white shadow-md font-bold"
              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <span>👑</span>
          <span>สำหรับหัวกิลด์ &amp; แอดมิน</span>
        </button>

        <button
          onClick={() => setActiveTab("credits")}
          className={`flex-1 min-w-[130px] px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "credits"
              ? "bg-teal-700 text-white shadow-md font-bold"
              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <span>⭐</span>
          <span>แต้มสะสม &amp; กฎกติกา</span>
        </button>

        <button
          onClick={() => setActiveTab("pwa")}
          className={`flex-1 min-w-[130px] px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "pwa"
              ? "bg-teal-700 text-white shadow-md font-bold"
              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <span>📱</span>
          <span>ใช้งานบนมือถือ (App PWA)</span>
        </button>

        <button
          onClick={() => setActiveTab("faq")}
          className={`flex-1 min-w-[130px] px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "faq"
              ? "bg-teal-700 text-white shadow-md font-bold"
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
                  <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 px-3 py-1.5 rounded-lg font-mono text-xs border border-zinc-300 dark:border-zinc-700">
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
                      ลงวอร์ + <strong>ต้องการลุ้นรับของ</strong> รอบนี้ พร้อมเลือกประเภทไอเทมที่ต้องการ
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-700/60 space-y-1">
                    <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <span>🟡</span>
                      <span>Join / Do not want to bid</span>
                    </div>
                    <div className="text-[12px] text-zinc-300">
                      ลงวอร์ + <strong>สละสิทธิ์รับของ</strong> เพื่อสะสมแต้ม Carry Credit (+1) ลัดคิวรอบหน้า!
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
                  ตรวจสอบลำดับและพิกัดสล็อตบนเว็บไซต์ (หรือบนมือถือ)
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  เข้าสู่หน้า{" "}
                  <Link href="/queues" className="text-teal-600 dark:text-teal-400 underline font-semibold">
                    จัดคิวและสล็อต (/queues)
                  </Link>{" "}
                  เพื่อดูว่าคุณได้คิวที่ <strong>Page ไหน ช่องที่เท่าไหร่ (1-4)</strong> โดยระบบจัดสล็อตจะตรงกับหน้าต่างประมูลในเกม Ragnarok Origin ทันที
                </p>
                <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                  <div>
                    💡 <strong>Tip:</strong> หากเห็นชื่อตัวเองขึ้น <em>&quot;รอประมูล&quot;</em> ให้เตรียมตัวกดบิดตามช่องที่ระบุไว้ เมื่อประมูลสำเร็จสถานะจะเปลี่ยนเป็น <em>&quot;ประมูลเสร็จแล้ว&quot;</em>
                  </div>
                  <div>
                    🎲 <strong>กรณีของขาดแคลน:</strong> หากของไม่พอกับจำนวนคนขอ ระบบจะแจกฐานเท่าเทียมให้ก่อนคนละ 1 ชิ้น และเปิดสุ่มแย่งเศษที่เหลืออย่างโปร่งใส <strong>คนที่ตกรอบจะได้แต้ม Carry Credit +1 ชดเชยทันที</strong>
                  </div>
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
                Workflow ครบวงจรตั้งแต่ก่อนเริ่มวอร์ คำนวณสล็อต สุ่มของขาดแคลน จนถึงการบันทึกประวัติจบงาน
              </p>
            </div>

            {/* Workflow Timeline */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Phase 1 */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-700">
                    Phase 1: ก่อนเริ่มวอร์
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">Discord</span>
                </div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                  1. เปิดโพลนับคนเข้าร่วม
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-300">
                  พิมพ์คำสั่งในห้องนัดหมาย Discord:
                </p>
                <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 px-3 py-1.5 rounded-lg font-mono text-xs border border-zinc-300 dark:border-zinc-700">
                  <span>/start_vote</span>
                  <button
                    onClick={() => copyToClipboard("/start_vote")}
                    className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-bold"
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
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                    Phase 2: จัดผังคน
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">Web Dashboard</span>
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
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700">
                    Phase 3: ตั้งค่าไอเทม &amp; คำนวณสล็อต
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">Web Dashboard</span>
                </div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                  3. กำหนดไอเทม &amp; ระบบจัดสรรเท่าเทียม
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-300">
                  ไปที่หน้า{" "}
                  <Link href="/queues" className="text-teal-600 dark:text-teal-400 underline font-semibold">
                    จัดคิวและสล็อต
                  </Link>{" "}
                  -&gt; แท็บ <strong>ตั้งค่าพิกัด &amp; ลิมิต</strong>:
                </p>
                <ul className="text-[12px] text-zinc-600 dark:text-zinc-300 space-y-1.5 list-disc list-inside">
                  <li>
                    <strong>ดูยอดคนจองแบบ Real-time:</strong> ในแต่ละกล่องไอเทมจะแสดงจำนวนสมาชิกที่โหวตจอง เช่น <code>🙋‍♂️ สมาชิกที่จอง: 10 คน</code>
                  </li>
                  <li>
                    <strong>ปุ่มลัด [🎯 ตั้งลิมิตพอดี]:</strong> คลิกเดียวตั้งค่าลิมิตให้หารลงตัวกับยอดคนทันที เช่น มี 10 ชิ้น คนขอ 10 คน ลิมิตจะปรับเป็น 1
                  </li>
                  <li>
                    <strong>สล็อตกระจายเท่าเทียม (Equitable Base):</strong> หากของมี 12 ชิ้น คนขอ 10 คน ลิมิต 2 ระบบจะแจกฐานให้คนละ 1 ชิ้นเท่ากันทุกคนก่อน และเปิดสุ่มแย่งเศษ 2 ชิ้น
                  </li>
                  <li>
                    <strong>คำนวณสล็อตใหม่ (Read-Only Preview):</strong> การกดคำนวณสล็อตเป็นการจำลองดูผลล่วงหน้า <em>จะยังไม่มีการตัดแต้มเครดิตหรือบันทึกข้อมูลใดๆ</em> ปลอดภัย 100%
                  </li>
                </ul>
              </div>

              {/* Phase 4 */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                    Phase 4: สุ่มของขาดแคลน
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">Random Roll</span>
                </div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                  4. ปิดโหวต &amp; สุ่มผู้โชคดี (Random Roll Modal)
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-300">
                  เมื่อถึงเวลา ให้กดปุ่ม <strong>&quot;ปิดโหวตรอบนี้&quot;</strong>:
                </p>
                <ul className="text-[12px] text-zinc-600 dark:text-zinc-300 space-y-1.5 list-disc list-inside">
                  <li>หากพบว่าไอเทมชิ้นไหนมีของน้อยกว่าคนขอ จะมีปุ่มสีม่วง <strong>&quot;🎲 สุ่มผู้โชคดี&quot;</strong> ปรากฏขึ้นมา</li>
                  <li>คลิกเพื่อเปิดหน้าต่างสุ่มฉลากสด แสดงภาพหมุนสุ่มและประกาศผลผู้โชคดีอย่างโปร่งใส</li>
                  <li>สมาชิกที่ตกรอบจะได้รับ <strong>Carry Credit +1 ชดเชย</strong> สำหรับรอบถัดไปอัตโนมัติ</li>
                </ul>
              </div>

              {/* Phase 5 */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 space-y-2.5 md:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                    Phase 5: ควบคุมกระดานสด &amp; บันทึกประวัติรอบนี้
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">Live Slot Board &amp; History Save</span>
                </div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                  5. คุมกระดานประมูลในเกม &amp; บันทึกผลรอบนี้เป็นประวัติ (สำคัญมาก!)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-600 dark:text-zinc-300">
                  <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">📌 ระหว่างการประมูล</div>
                    <ul className="space-y-1 list-disc list-inside text-[11px]">
                      <li><strong>กดประมูลทีละช่อง:</strong> ติ๊กเลือกช่องสล็อต แล้วกดยืนยัน</li>
                      <li><strong>เลือกหลายช่อง (Batch Award):</strong> เลือกช่องในหน้านี้หรือทุกหน้า แล้วกดมอบรางวัลพร้อมกันผ่านแถบ Floating Bar ด้านล่าง</li>
                      <li><strong>ข้ามคิว (Skip):</strong> หากสมาชิกไม่อยู่ในเวลาประมูล</li>
                    </ul>
                  </div>

                  <div className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 space-y-1">
                    <div className="font-bold text-emerald-800 dark:text-emerald-300">💾 ปุ่ม &quot;บันทึกผลรอบนี้เป็นประวัติ&quot; (Commit Point)</div>
                    <p className="text-[11px] leading-relaxed">
                      เมื่อการประมูลเสร็จสิ้น ให้กดปุ่มสีเขียว <strong>&quot;💾 บันทึกผลรอบนี้เป็นประวัติ&quot;</strong> เพื่อ:
                    </p>
                    <ul className="space-y-0.5 list-disc list-inside text-[11px] text-emerald-900 dark:text-emerald-200">
                      <li>บันทึกผลรอบนี้เข้าสู่ระบบประวัติ (Audit History) ถาวร</li>
                      <li>ตัดแต้มเครดิตของผู้ที่ได้รับของจริง</li>
                      <li>มอบแต้มชดเชย (+1 Credit) แก่ผู้ที่ไม่ได้ของ หรือได้ไม่ครบตามลิมิต</li>
                    </ul>
                  </div>
                </div>
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
                ระบบที่ออกแบบมาเพื่อให้คนช่วยกิลด์วอร์สม่ำเสมอได้รับรางวัลอย่างคุ้มค่า ยุติธรรม และไม่เสียเปรียบ
              </p>
            </div>

            {/* Core Principles */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-2">
                <div className="text-2xl">🤝</div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                  1. ช่วยวอร์ สะสมแต้ม
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  เมื่อสมาชิกเลือก <strong>&quot;Join the war / Do not want to bid&quot;</strong> จะได้รับ <strong>+1 Credit</strong> ในไอเทมประเภทนั้น สะสมไว้ในบัญชีของคุณทันที
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-2">
                <div className="text-2xl">🚀</div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                  2. สิทธิ์ลัดคิวรอบถัดไป
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  ในรอบที่คุณตัดสินใจเลือก <strong>&quot;Want to bid&quot;</strong> ระบบจัดสล็อตจะจัดอันดับให้คนที่มี <strong>แต้ม Credit สูงสุดขึ้นรับของก่อน</strong>
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-2">
                <div className="text-2xl">🛡️</div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                  3. แต้มชดเชยของไม่พอ
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  หากมาวอร์และขอของ แต่ของไม่พอ หรือตกรอบสุ่ม หรือได้ไม่ครบตามลิมิต ระบบจะมอบ <strong>+1 Carry Credit ชดเชย</strong> สำหรับรอบถัดไปให้โดยอัตโนมัติ
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-2">
                <div className="text-2xl">⚖️</div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                  4. ตัดแต้มเมื่อได้รับของ
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  แต้มจะถูกหักออกเฉพาะผู้ที่ได้รับของจริงเมื่อแอดมินกด <strong>&quot;บันทึกผลรอบนี้เป็นประวัติ&quot;</strong> เพื่อเปิดโอกาสให้เพื่อนสมาชิกท่านอื่นขึ้นมารับต่อในรอบถัดไป
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

      {/* TAB CONTENT 4: MOBILE APP & PWA */}
      {activeTab === "pwa" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6 shadow-sm">
            <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>📱</span>
                <span>การติดตั้งและใช้งานบนมือถือ (Mobile Application - PWA)</span>
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                ติดตั้งระบบประมูล RoOC ไว้บนหน้าจอมือถือของคุณ เปิดดูคิวสด พิกัดหน้า/ช่องในเกมได้สะดวกแบบเรียลไทม์
              </p>
            </div>

            {/* Why Install */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/50 space-y-1">
                <div className="text-sm font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                  <span>⚡</span>
                  <span>เปิดเต็มจอ Standalone</span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  ไม่มีแถบ URL บราวเซอร์ เปิดใช้งานได้เต็มจอและโหลดเร็วกว่าเดิม
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/50 space-y-1">
                <div className="text-sm font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                  <span>👆</span>
                  <span>Thumb-Friendly Nav Bar</span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  แถบเมนูด้านล่าง 5 ปุ่ม แตะเปลี่ยนหน้า คุมสล็อต และดูเครดิตด้วยนิ้วโป้งมือเดียว
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/50 space-y-1">
                <div className="text-sm font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                  <span>🎮</span>
                  <span>จอที่สองขณะเล่นเกม</span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  ตั้งมือถือไว้ข้างจอคอม ดูพิกัดสล็อตสดแล้วกดบิดในเกมตามได้ทันที
                </p>
              </div>
            </div>

            {/* Step-by-Step Installation Guide */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* iOS Guide */}
              <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 space-y-4">
                <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-200 dark:border-zinc-700">
                  <span className="text-xl">🍏</span>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      สำหรับ iPhone / iPad (Safari)
                    </h3>
                    <p className="text-[11px] text-zinc-500">ติดตั้งผ่าน Safari ใน 3 สเต็ปง่ายๆ</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs text-zinc-700 dark:text-zinc-300">
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      เปิดเว็บนี้ด้วย <strong>Safari</strong> บน iPhone ของคุณ
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      แตะที่ปุ่มแชร์ <strong>Share (ไอคอนสี่เหลี่ยมลูกศรชี้ขึ้น ⎋)</strong> ที่แถบด้านล่างของหน้าจอ
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      เลื่อนลงมาแล้วเลือก <strong>&quot;เพิ่มไปยังหน้าจอโฮม&quot; (Add to Home Screen)</strong> แล้วกด <strong>&quot;เพิ่ม&quot; (Add)</strong> ที่มุมบนขวา
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-teal-100/60 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-800 text-[11px] text-teal-900 dark:text-teal-200">
                  ✨ จะมีไอคอนแอป RoOC อยู่บนหน้าจอมือถือของคุณทันที เปิดใช้งานได้ลื่นไหล ไม่ซูมเด้งไปมา
                </div>
              </div>

              {/* Android Guide */}
              <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 space-y-4">
                <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-200 dark:border-zinc-700">
                  <span className="text-xl">🤖</span>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      สำหรับ Android (Chrome)
                    </h3>
                    <p className="text-[11px] text-zinc-500">ติดตั้งง่ายในคลิกเดียวผ่าน Google Chrome</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs text-zinc-700 dark:text-zinc-300">
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      เปิดเว็บนี้ผ่าน <strong>Google Chrome</strong> บนมือถือ Android
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      ระบบจะแสดงแถบแจ้งเตือน <strong>&quot;ติดตั้ง RoOC Auction App&quot;</strong> ขึ้นมาโดยอัตโนมัติ
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      กดปุ่ม <strong>&quot;ติดตั้ง&quot;</strong> หรือแตะเมนูสามจุด (⋮) ด้านขวาบน แล้วเลือก <strong>&quot;ติดตั้งแอป&quot; (Install App)</strong>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-teal-100/60 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-800 text-[11px] text-teal-900 dark:text-teal-200">
                  ✨ แอปจะถูกติดตั้งลงในหน้ารวมแอปของเครื่อง สามารถเปิดใช้งานได้เสมือนแอปจาก Play Store ทันที
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: FAQ */}
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
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-teal-700 dark:text-teal-400">
                  Q: กดปุ่ม &quot;คำนวณสล็อตใหม่&quot; แล้วข้อมูลหรือแต้มเครดิตจะถูกบันทึกทันทีเลยไหม?
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  A: <strong>ไม่ถูกบันทึกครับ</strong> การกด &quot;คำนวณสล็อตใหม่&quot; เป็นเพียงการแสดงผลตัวอย่างล่วงหน้า (Preview / Read-Only) แอดมินสามารถทดลองเปลี่ยนจำนวนหรือปรับลิมิตได้ตามต้องการ ระบบจะตัดแต้มเครดิตและบันทึกประวัติก็ต่อเมื่อกดปุ่ม <strong>&quot;💾 บันทึกผลรอบนี้เป็นประวัติ&quot;</strong> เท่านั้น
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-1.5">
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-teal-700 dark:text-teal-400">
                  Q: กรณีของมีไม่พอ หรือคนขอได้ของไม่ครบตามลิมิต ระบบจัดการอย่างไร?
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  A: ระบบจะทำการ <strong>แจกฐานคนละ 1 ชิ้นเท่ากันทุกคนก่อน</strong> (เช่น มี 12 ชิ้น คนขอ 10 คน จะแจกคนละ 1 ชิ้น รวม 10 ชิ้น) ส่วนเศษที่เหลือ 2 ชิ้น จะมีปุ่มสีม่วง <strong>&quot;🎲 สุ่มผู้โชคดี&quot;</strong> ให้แอดมินกดเปิดสุ่มอย่างโปร่งใส และทุกคนที่ได้ของไม่ครบจะได้รับแต้ม <strong>Carry Credit +1 ชดเชย</strong> สำหรับรอบถัดไปอัตโนมัติเมื่อบันทึกประวัติ
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-1.5">
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-teal-700 dark:text-teal-400">
                  Q: ปุ่ม &quot;🎯 ตั้งลิมิตพอดี&quot; ช่วยอะไร และมีประโยชน์อย่างไร?
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  A: ช่วยให้แอดมินไม่ต้องคิดเลขหรือสลับหน้าจอนับคนครับ ระบบจะนับยอดคนที่โหวตจองจริงในรอบนั้น แล้วคำนวณสัดส่วนที่หารลงตัว (Fair Share) ให้ทันที เช่น มี 10 ชิ้น คนขอ 10 คน ปุ่มจะแนะนำลิมิต 1 ชิ้น เมื่อคลิกแล้วจะใส่ค่าลงช่องลิมิตให้ทันที ของจะไม่ขาดแคลนและสมาชิกทุกคนได้ของเท่ากันครบทุกคน
                </p>
              </div>

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

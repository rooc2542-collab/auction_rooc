# RoOC Guild Auction — Project Development Rules

## 1. Dual-Theme Support Requirement (Light Mode & Dark Mode)
- **ทุกคอมโพเนนต์และทุกหน้าจอที่พัฒนาหรือแก้ไข ต้องรองรับทั้ง Light Mode และ Dark Mode เสมอ 100%**
- ห้ามใช้คลาสสีเข้มลึก (เช่น `bg-zinc-900`, `bg-emerald-950`, `text-zinc-100`) แบบเดี่ยวๆ โดยไม่มีคลาส Light Mode ประกบคู่
- ป้ายสถานะ (Badges) ต้องใช้คู่สีแบบ Dual-Theme เสมอ:
  - Success: `bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800/50`
  - Warning: `bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800/50`
  - Danger: `bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800/50`
  - Info: `bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/80 dark:text-sky-300 dark:border-sky-800/50`
- กล่องและ Container: ใช้ `bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800`
- ช่องกรอกข้อมูล (Inputs): ใช้ `bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100`
- ปฏิบัติตามแนวทางฉบับเต็มใน Skill: [dual-theme-ui](.agents/skills/dual-theme-ui/SKILL.md)

## 2. Mobile & PWA UX Standards
- รักษาระยะความสูงปลอดภัยบนมือถือ (`main { padding-bottom: ... }`) เพื่อไม่ให้ Bottom Navigation Bar บังเนื้อหา
- คงขนาดฟอนต์ช่อง input บนมือถือ $\ge 16\text{px}$ เพื่อป้องกัน Safari Auto-Zoom
- พื้นที่สัมผัส (Touch Targets) สำหรับปุ่มกดบนมือถือต้อง $\ge 44\text{px} \times 44\text{px}$ เสมอ

## 3. Allocation & Credit Data Integrity
- การคำนวณสล็อต (`run_allocation`) ต้องเป็น Read-Only ต่อตาราง Carry Credit เสมอ
- การตัดแต้มหรือมอบแต้มชดเชยจะเกิดขึ้นเมื่อกด "💾 บันทึกผลรอบนี้เป็นประวัติ" (`save_round_history`) เท่านั้น

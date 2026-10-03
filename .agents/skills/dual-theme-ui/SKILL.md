---
name: dual-theme-ui
description: >-
  Guidelines and standards for designing and implementing UI components that flawlessly support both Dark Mode and Light Mode with proper contrast, semantic colors, and Tailwind CSS. Use whenever developing, styling, or auditing UI components or pages.
---

# Dual-Theme UI Design & Implementation (Light & Dark Mode)

มาตรฐานและแนวทางปฏิบัติในการออกแบบ พัฒนา และตรวจสอบ UI ทุกหน้าในระบบ RoOC Guild Auction เพื่อให้รองรับทั้ง **Light Mode** และ **Dark Mode** อย่างสมบูรณ์แบบ สบายตา คอนทราสต์ถูกต้อง ไม่มีสีหลุดหรือกลายเป็นกล่องสีดำในโหมดสว่าง

---

## 1. กฎเหล็ก (Core Principles)

1. **ห้ามใช้สีโทนเข้มหรือสว่างแบบ Hardcoded เด็ดขาด**:
   - ❌ ผิด: `className="bg-zinc-900 text-zinc-100 border-zinc-800"`
   - ✅ ถูก: `className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-800"`
2. **จับคู่สีพื้นหลัง (Background) และสีตัวอักษร (Text) เสมอ**:
   - ถ้าเปลี่ยนพื้นหลัง ต้องเปลี่ยนสีตัวอักษรและเส้นขอบให้เข้าคู่กันเสมอ เพื่อป้องกันปัญหาตัวอักษรกลืนกับพื้นหลัง
3. **ห้ามใช้คลาสสีเข้มลึก (950 / 900) ใน Light Mode โดยไม่มีคลาส Light Mode ประกบคู่**:
   - ❌ ผิด: `bg-emerald-950/80 text-emerald-300` (จะกลายเป็นกล่องสีดำทึบใน Light Mode)
   - ✅ ถูก: `bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/50`

---

## 2. ตารางคู่สีมาตรฐาน (Color Palette Matrix)

### พื้นผิวและกล่องข้อความ (Surfaces & Containers)
| ประเภทส่วนประกอบ | Light Mode | Dark Mode | คลาส Tailwind ที่ต้องใช้ |
| :--- | :--- | :--- | :--- |
| **Page Background** | `#f8fafc` | `#09090b` | `bg-white dark:bg-zinc-950` |
| **Main Card / Card Container** | สีขาว คมชัด | `zinc-900` | `bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs` |
| **Sub-box / Nested Section** | สีเทาอ่อนมาก | `zinc-800/40` | `bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60` |
| **Modal / Dialog Content** | สีขาว | `zinc-900` | `bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-2xl` |

### ตัวอักษร (Typography)
| ระดับความสำคัญ | Light Mode | Dark Mode | คลาส Tailwind ที่ต้องใช้ |
| :--- | :--- | :--- | :--- |
| **Primary (หัวข้อ/ชื่อ)** | `zinc-900` | `zinc-100` | `text-zinc-900 dark:text-zinc-100` |
| **Secondary (คำบรรยาย/คำแนะนำ)** | `zinc-500` | `zinc-400` | `text-zinc-500 dark:text-zinc-400` |
| **Muted / Subtext** | `zinc-400` | `zinc-500` | `text-zinc-400 dark:text-zinc-500` |

### ป้ายสถานะ (Badges & Pills)
| สถานะ / โทนสี | Light Mode | Dark Mode | คลาส Tailwind ที่ต้องใช้ |
| :--- | :--- | :--- | :--- |
| **Success / สำเร็จ (Emerald)** | เขียวอ่อน สบายตา | เขียวเข้มเรืองแสง | `bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800/50` |
| **Warning / แจ้งเตือน (Amber)** | ส้มเหลืองอ่อน | ส้มเข้มเรืองแสง | `bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800/50` |
| **Danger / ยกเลิก (Rose)** | ชมพูแดงอ่อน | แดงเข้มเรืองแสง | `bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800/50` |
| **Info / ข้อมูล (Sky/Blue)** | ฟ้าอ่อน | น้ำเงินเข้มเรืองแสง | `bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/80 dark:text-sky-300 dark:border-sky-800/50` |
| **Neutral / ทั่วไป (Zinc)** | เทาอ่อน | เทาเข้ม | `bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700` |

### ฟอร์มและการกรอกข้อมูล (Forms & Inputs)
| ส่วนประกอบ | Light Mode | Dark Mode | คลาส Tailwind ที่ต้องใช้ |
| :--- | :--- | :--- | :--- |
| **Input / Select / Textarea** | ขาว กรอบเทาอ่อน | ดำ กรอบเทาเข้ม | `bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-teal-500` |
| **Secondary Button** | เทาอ่อน hover เทา | เทาเข้ม hover ดำ | `bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700` |
| **Primary Brand Button** | สีเขียวอมฟ้า Teal | สีเขียวอมฟ้า Teal | `bg-teal-700 hover:bg-teal-600 active:scale-95 text-white font-bold shadow-sm transition-all` |

---

## 3. ขั้นตอนการตรวจสอบก่อนส่งงาน (Verification Checklist)

เมื่อออกแบบหรือปรับแต่ง UI ใดๆ ให้ตรวจสอบ 4 ข้อนี้เสมอ:

- [ ] **สลับทดสอบ Dark Mode และ Light Mode**: ตรวจสอบทั้ง 2 โหมดโดยการกดปุ่มสลับธีมบนแถบ Navbar หรือเปิดดูในบราวเซอร์
- [ ] **ตรวจสอบ Contrast ของป้าย Badge**: ไม่มีป้ายสถานะใดกลายเป็นกล่องสีดำทึบใน Light Mode
- [ ] **ตรวจสอบช่องกรอก Input**: สีพื้นหลัง ตัวอักษรที่พิมพ์ และ placeholder ต้องอ่านออกชัดเจน ไม่กลืนกับพื้นหลัง
- [ ] **ตรวจสอบหน้าต่างป็อปอัป (Modals & Bottom Sheet)**: มีพื้นหลังและการแบ่งเส้นขอบที่ชัดเจน ไม่โปร่งแสงจนกลืนกับเนื้อหาด้านหลัง

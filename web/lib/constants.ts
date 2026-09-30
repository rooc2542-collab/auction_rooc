// ชื่อแสดงผลและ config ของแต่ละไอเทม
export const ITEM_CONFIG = {
  Album: {
    label: "สมุดการ์ด",
    desc: "สมุดเลือกการ์ดส้ม/การ์ดบอสปลอม",
    color: "purple",
    bg: "bg-purple-50 dark:bg-purple-900/20",
    border: "border-purple-300 dark:border-purple-700",
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  },
  Puppet: {
    label: "เศษการ์ดบอส",
    desc: "เศษการ์ดบอสปลอมสำหรับสะสม",
    color: "amber",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-300 dark:border-amber-700",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  },
  White: {
    label: "ขนนกขาว",
    desc: "ขนนกขาวเกรดอัปเกรดสเตตัส",
    color: "slate",
    bg: "bg-slate-50 dark:bg-slate-800/40",
    border: "border-slate-300 dark:border-slate-600",
    badge: "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
  },
  RedBlack: {
    label: "ขนนกดำแดง",
    desc: "ขนนกแดง/ดำสเตตัสขั้นสูง",
    color: "red",
    bg: "bg-red-50 dark:bg-red-900/20",
    border: "border-red-300 dark:border-red-700",
    badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  },
} as const

export type ItemType = keyof typeof ITEM_CONFIG

export const VOTE_LABELS = {
  want_bid: "ต้องการประมูล",
  no_bid: "ไม่ประมูล (สะสม credit)",
  absent: "ไม่เข้าร่วม",
} as const

export const ROUND_STATUS_LABELS = {
  voting: "กำลังโหวต",
  bidding: "กำลังจองคิว",
  closed: "ปิดแล้ว",
} as const

# คู่มือระบบการทำงาน Auction System (ระบบประมูลและจัดสรรไอเทมกิลด์)
## ROOC Guild Management System — ฉบับละเอียดครบทุกซอกทุกมุม

> **เวอร์ชันเอกสาร:** 2.0 (Dual-Engine: Classic Queue + Round-Robin Rotation System)  
> **ไฟล์หลักที่เกี่ยวข้อง:**  
> - Server Actions: `app/actions/auction.ts`, `app/actions/auction-rounds.ts`  
> - Routes: `app/auction/page.tsx`  
> - Client Components: `components/auction/*`, `components/auction/rounds/*`  
> - Database Migrations: `migrations/005_*`, `006_*`, `020_*`, `021_*`, `022_*`, `024_*`  

---

## สารบัญ (Table of Contents)
1. [ภาพรวมสถาปัตยกรรม (Architecture & Dual-Engine Overview)](#1-ภาพรวมสถาปัตยกรรม-architecture--dual-engine-overview)
2. [ประเภทไอเทมและค่าคงที่ (Item Types & Configuration)](#2-ประเภทไอเทมและค่าคงที่-item-types--configuration)
3. [โครงสร้างฐานข้อมูลและ Migration (Database Schema & RPCs)](#3-โครงสร้างฐานข้อมูลและ-migration-database-schema--rpcs)
4. [เจาะลึก Server Actions: ระบบคิวปกติ (`auction.ts`)](#4-เจาะลึก-server-actions-ระบบคิวปกติ-auctionts)
5. [เจาะลึก Server Actions: ระบบรอบการประมูลกิลด์ (`auction-rounds.ts`)](#5-เจาะลึก-server-actions-ระบบรอบการประมูลกิลด์-auction-roundsts)
6. [กลไกการคำนวณและจัดสรรสล็อต (Slot Allocation & Rendering Engine)](#6-กลไกการคำนวณและจัดสรรสล็อต-slot-allocation--rendering-engine)
7. [หน้าต่างแสดงผลและการควบคุม UI (AuctionWindow & 6 View Modes)](#7-หน้าต่างแสดงผลและการควบคุม-ui-auctionwindow--6-view-modes)
8. [ระบบ Modal ควบคุมของแอดมิน (Admin Modals & Advanced Tools)](#8-ระบบ-modal-ควบคุมของแอดมิน-admin-modals--advanced-tools)
9. [การทำงานแบบ Realtime และ Caching (0ms Tab Switch & WebSocket)](#9-การทำงานแบบ-realtime-และ-caching-0ms-tab-switch--websocket)
10. [สรุปกฎเกณฑ์ทางธุรกิจและความปลอดภัย (Business Rules & Security Guards)](#10-สรุปกฎเกณฑ์ทางธุรกิจและความปลอดภัย-business-rules--security-guards)

---

## 1. ภาพรวมสถาปัตยกรรม (Architecture & Dual-Engine Overview)

ระบบประมูลของ ROOC ถูกออกแบบมาเพื่อตอบโจทย์การบริหารจัดการของรางวัลจากการกิลด์วอร์ (Guild War / GVG) และบอสโลก โดยมีจุดเด่นคือการรองรับ **2 โหมดการทำงานคู่ขนาน (Dual-Engine)** ที่สามารถสลับใช้งานได้ทันที:

```
+-----------------------------------------------------------------------------------+
|                           ROOC AUCTION SYSTEM CORE                               |
+-----------------------------------------------------------------------------------+
                                         |
         +-------------------------------+-------------------------------+
         |                                                               |
         v                                                               v
+----------------------------------+            +----------------------------------+
|      ENGINE 1: SELF-BOOKING      |            |     ENGINE 2: ROUND ROTATION     |
|   (โหมดสมาชิกจองเองอิสระ)        |            |   (โหมดรอบการประมูลกิลด์อัตโนมัติ)|
+----------------------------------+            +----------------------------------+
| - สมาชิกกดจองคิวเองผ่านโปรไฟล์   |            | - หัวกิลด์กำหนดรอบและโควตาต่อคน  |
| - โควตาสูงสุด 10 ชิ้นต่อคน       |            | - เรียงคิวตามผังปาร์ตี้กิลด์จริง |
| - ระบบ 1 Row = 1 Slot (Split)    |            | - ระบบโอนสิทธิ์ / สละสิทธิ์      |
| - แสดงคิวข้ามวัน (Waiting ทบยอด) |            | - ทบยอดค้างรอบเก่า (Rollover)    |
| - แอดมินจองแทนได้ (Proxy)        |            | - เทมเพลตจัดคิวล่วงหน้า          |
+----------------------------------+            +----------------------------------+
         |                                                               |
         +-------------------------------+-------------------------------+
                                         |
                                         v
                         +-------------------------------+
                         |    LIVE DASHBOARD & AUDIT     |
                         +-------------------------------+
                         | - กระดานสล็อตสด 4 ช่องต่อหน้า |
                         | - ติ๊กหลายช่องแจกพร้อมกัน     |
                         |   (High-Speed Batch Award)    |
                         | - ซิงค์ข้ามเครื่อง Realtime   |
                         | - ประวัติย้อนหลัง & กดยกเลิก  |
                         +-------------------------------+
```

---

## 2. ประเภทไอเทมและค่าคงที่ (Item Types & Configuration)

ระบบประมูลผูกกับไอเทมหลักของกิลด์ 4 ประเภท ประกาศเป็น Type `ItemType`:

| Item Key | ชื่อภาษาไทย | รายละเอียด | Icon Path | ธีมสีประจำไอเทม |
| :--- | :--- | :--- | :--- | :--- |
| `Album` | **สมุดการ์ด** | สมุดเลือกการ์ดส้ม / การ์ดบอสปลอม | `/auction/Puppet.png` | สีม่วง (`purple-500/20`) |
| `Puppet` | **เศษการ์ดบอส** | เศษการ์ดบอสปลอมสำหรับสะสม | `/auction/Illusion.png` | สีส้ม/อำพัน (`amber-500/20`) |
| `White` | **ขนขาว** | ขนนกขาวเกรดอัปเกรดสเตตัส | `/auction/Light-Dark Opt.Chest.png` | สีเงิน/ขาว (`slate-200/40`) |
| `RedBlack` | **ขนดำแดง** | ขนนกแดง/ดำสเตตัสขั้นสูง | `/auction/Time-Space Opt.Chest.png` | สีแดงกุหลาบ (`red-500/20`) |

ค่า Configuration เหล่านี้ถูกรวมศูนย์ไว้ที่ `components/auction/constants.tsx` เพื่อให้ทุก Component แสดงผลไอคอน ป้ายชื่อคำอธิบาย และสีพื้นหลังตรงกันทั้งระบบ

---

## 3. โครงสร้างฐานข้อมูลและ Migration (Database Schema & RPCs)

ระบบ Auction ขับเคลื่อนด้วยตารางฐานข้อมูลหลัก 6 ตารางบน Supabase (PostgreSQL):

### 3.1 ตาราง `auction_sessions` (การตั้งค่ากระดานรายวัน)
เก็บข้อมูลการเปิดประมูลในแต่ละวันของกิลด์:
- `id` (UUID, PK)
- `guild_id` (UUID, FK -> guilds)
- `session_date` (DATE): วันที่เปิดประมูล (รูปแบบ `YYYY-MM-DD`)
- `item_name` (TEXT): ชนิดของไอเทม (`Album`, `Puppet`, `White`, `RedBlack`)
- `total_quantity` (INTEGER): จำนวนชิ้นทั้งหมดที่มีให้ประมูลในวันนี้
- `personal_limit` (INTEGER): โควตาสูงสุดที่สมาชิก 1 คนสามารถได้รับในวันนี้
- `item_priority` (INTEGER): ลำดับความสำคัญในการแสดงผล
- `status` (TEXT): สถานะของเซสชัน (`active`)

### 3.2 ตาราง `auction_queues` (คิวประมูลรายสล็อต)
ปรับปรุงตาม Migration `006_split_auction_slots.sql` เพื่อป้องกันการล็อกทั้งก้อน โดย **1 แถว = 1 สล็อต (requested_qty = 1)**:
- `id` (UUID / BIGSERIAL, PK)
- `guild_id` (UUID, FK -> guilds)
- `user_id` (UUID, FK -> profiles)
- `item_name` (TEXT)
- `requested_qty` (INTEGER DEFAULT 1): ล็อกที่ 1 ชิ้นต่อแถว
- `received_qty` (INTEGER DEFAULT 0): 0 = ยังไม่ได้, 1 = ได้รับแล้ว
- `status` (TEXT): `'waiting'` (รอคิว), `'partial'`, `'completed'` (ได้รับแล้ว)
- `slot_number` (INTEGER DEFAULT 1): ลำดับชิ้นของสมาชิกคนนั้น (เช่น จอง 3 ชิ้น จะได้สล็อต 1, 2, 3)
- `queue_timestamp` (TIMESTAMPTZ): เวลาที่ทำการจอง ใช้จัดลำดับก่อน-หลัง (FIFO)
- `updated_at` (TIMESTAMPTZ)
- **Constraint สำคัญ:** `unique_member_slot_per_item_date` (`user_id`, `item_name`, `slot_number`, `guild_id`) ป้องกันสล็อตซ้ำ

### 3.3 ตาราง `auction_rounds` (ข้อมูลรอบการประมูลกิลด์)
ตาม Migration `020_add_auction_rounds_system.sql`:
- `id` (UUID, PK)
- `guild_id` (UUID, FK -> guilds)
- `item_name` (TEXT)
- `round_number` (INTEGER DEFAULT 1): รอบที่เท่าไหร่ของไอเทมนี้
- `base_quota_per_member` (INTEGER DEFAULT 1): โควตาเป้าหมายต่อคนในรอบนี้
- `status` (TEXT): `'active'`, `'completed'`, `'archived'`
- `total_eligible_members` (INTEGER): จำนวนสมาชิกกิลด์ทั้งหมดที่มีสิทธิ์ในรอบนี้
- `completed_members_count` (INTEGER): จำนวนคนที่ได้รับครบโควตาแล้ว
- `started_at`, `completed_at`, `created_by`, `updated_at`
- **Constraint:** `unique_guild_item_round` (`guild_id`, `item_name`, `round_number`)

### 3.4 ตาราง `auction_round_members` (สมาชิกและโควตารายบุคคลในรอบ)
- `id` (UUID, PK)
- `round_id` (UUID, FK -> auction_rounds)
- `guild_id` (UUID, FK -> guilds)
- `user_id` (UUID, FK -> profiles)
- `item_name` (TEXT), `round_number` (INTEGER)
- `base_quota` (INTEGER DEFAULT 1): โควตาพื้นฐาน
- `transferred_in_quota` (INTEGER DEFAULT 0): โควตาที่ได้รับโอนมาเพิ่ม (+)
- `transferred_out_quota` (INTEGER DEFAULT 0): โควตาที่โอนออกไปให้เพื่อน (-)
- `target_quota` (INTEGER GENERATED ALWAYS AS (`base_quota + transferred_in_quota - transferred_out_quota`) STORED): โควตาสุทธิที่ระบบคำนวณอัตโนมัติระดับฐานข้อมูล
- `received_qty` (INTEGER DEFAULT 0): จำนวนที่ได้รับสะสมไปแล้วในรอบนี้
- `status` (TEXT): `'pending'`, `'in_progress'`, `'completed'`, `'skipped'`, `'transferred'`, `'left_guild'`
- `queue_order` (INTEGER): ลำดับคิวในรอบ (จัดตามผังปาร์ตี้ หรือลากสลับ)
- `note` (TEXT), `updated_at` (TIMESTAMPTZ)

### 3.5 ตาราง `auction_round_transfers` (ประวัติการโอนสิทธิ์)
- `id` (UUID, PK)
- `guild_id`, `round_id`, `round_number`, `item_name`
- `from_user_id` (UUID), `to_user_id` (UUID)
- `transfer_qty` (INTEGER): จำนวนชิ้นที่โอน
- `transfer_type` (TEXT): `'partial'` (โอนเฉพาะไอเทมนี้) หรือ `'full'` (โอนสิทธิ์ที่เหลือทั้งหมด)
- `performed_by` (UUID), `note` (TEXT), `created_at` (TIMESTAMPTZ)

### 3.6 ตาราง `auction_round_logs` (Audit Log และประวัติการมอบรางวัล)
- `id` (UUID, PK)
- `guild_id`, `round_id`, `round_number`, `item_name`
- `action_type` (TEXT):
  - `'AWARD'`: มอบรางวัลจากกระดานสด
  - `'MANUAL_OVERRIDE'`: แอดมินกดแจกโดยตรงในหน้ารอบ
  - `'TRANSFER'`: โอนสิทธิ์
  - `'SWAP'`: สลับตำแหน่งคิว
  - `'SKIP'`: สละสิทธิ์/ข้ามคิว
  - `'REORDER_QUEUE'`: จัดเรียงคิวใหม่ทั้งชุด
  - `'ROUND_START'`: เปิดรอบใหม่
  - `'ROUND_CLOSE'`: จบรอบ
- `target_user_id` (UUID), `related_user_id` (UUID)
- `qty` (INTEGER): จำนวนชิ้นที่ทำรายการ (ติดลบกรณีลบประวัติ)
- `performed_by` (UUID), `details` (JSONB), `note` (TEXT), `created_at` (TIMESTAMPTZ)

### 3.7 ตาราง `auction_queue_templates` (เทมเพลตจัดคิวล่วงหน้า)
ตาม Migration `024_add_auction_queue_templates.sql`:
- `id` (UUID, PK)
- `guild_id` (UUID, FK -> guilds)
- `name` (TEXT): ชื่อเทมเพลต (เช่น "ผังวันอาทิตย์", "เรียงตามคะแนนวอร์")
- `description` (TEXT)
- `member_ids` (JSONB): รายชื่อ Profile UUID ที่เรียงลำดับไว้แล้ว
- `created_by`, `created_at`, `updated_at`

### 3.8 Atomic RPC Functions (Stored Procedures)
ตาม Migration `022_add_auction_and_party_rpcs.sql`:
- `process_award_auction_slot(p_queue_id, p_admin_id, p_guild_id, p_note)`: มอบรางวัล 1 สล็อตแบบ Isolated Transaction ป้องกัน Race Condition
- `batch_award_auction_slots(p_queue_ids, p_admin_id, p_guild_id, p_note)`: มอบรางวัลแบบกลุ่มหลายสล็อตในคำสั่งเดียว ป้องกัน Timeout
- `batch_configure_guild_round_quotas(p_guild_id, p_album_quota, p_puppet_quota, p_white_quota, p_redblack_quota)`: อัปเดตโควตาทั้ง 4 ไอเทมรวดเดียวภายใน 20ms

---

## 4. เจาะลึก Server Actions: ระบบคิวปกติ (`auction.ts`)

ไฟล์ `app/actions/auction.ts` รับผิดชอบการทำงานของระบบคิวแบบดั้งเดิม (Classic Queue Engine):

| ชื่อฟังก์ชัน | สิทธิ์ (Role) | พารามิเตอร์ | คำอธิบายการทำงานเชิงลึก |
| :--- | :--- | :--- | :--- |
| `saveAuctionSession` | แอดมิน | `items: { item_type, total_quantity, personal_limit }[]` | ลบเซสชันเดิมของวันนี้ออก และบันทึกยอดไอเทมรายวันตัวใหม่ จากนั้นสั่ง `revalidatePath('/auction')` |
| `joinAuctionQueue` | สมาชิก/แอดมิน | `itemType: ItemType, requestedQty: number` | ตรวจสอบยอดจองสะสมรวมไม่เกิน 10 ชิ้น หากผ่าน จะหา `max(slot_number)` เดิม แล้วทำการ INSERT แบบแตกแถว N แถว (1 row = 1 slot) สถานะ `'waiting'` |
| `joinAuctionQueues` | สมาชิก/แอดมิน | `items: { itemType, qty }[]` | ทำ Batch Booking จองหลายไอเทมพร้อมกันในคำสั่งเดียว มีการตรวจสอบ Limit 10 ชิ้นทุกไอเทมล่วงหน้าก่อน Insert |
| `getTodayAuctionDashboard` | สมาชิกในกิลด์ | - | ดึงข้อมูลภาพรวม: ไอเทมเซสชันวันนี้, คิวสมาชิกทั้งหมดที่รออยู่ (`waiting`) ข้ามวันได้ + คิวที่ได้รับของแล้ว (`completed`) เฉพาะของวันนี้ เพื่อแสดงบนกระดานสด |
| `getAuctionHistory` | สมาชิกในกิลด์ | - | ทำการดึงข้อมูลและ Merge ระหว่าง `auction_queues` (คิวปกติ) และ `auction_round_logs` (คิวรอบ) เรียงจากใหม่ไปเก่าสำหรับแท็บ History |
| `awardAuctionQueue` | แอดมิน | `queueId: string \| number, awardQty: number, note?: string` | มอบรางวัลสล็อต: เรียกผ่าน RPC `process_award_auction_slot` หากล้มเหลวจะเข้า Fallback Logic ตรวจสอบ Daily Personal Limit และเชื่อมต่ออัตโนมัติไปยัง `awardRoundProgress` |
| `batchAwardAuctionQueues` | แอดมิน | `queueIds: string[], note?: string` | **พระเอกด้าน Performance:** รับ Array ของ queueIds ติ๊กเลือก แล้วแยกประเภทสล็อตระหว่าง Round Slots (`round_`) กับ Classic Queue เพื่อบันทึกผลก้อนเดียวใน 1 Transaction |
| `syncUserAuctionQueues` | สมาชิก | `items: { itemType, qty }[]` | ระบบคำนวณส่วนต่าง (Diff Calculation): หากสมาชิกปรับตัวเลขจองเพิ่ม ระบบจะสร้างแถวสล็อตเพิ่ม หากปรับลด ระบบจะ DELETE สล็อตที่ยังรออยู่ตามจำนวนที่ลด |
| `skipAuctionQueue` | แอดมิน | `queueId: string \| number` | อัปเดต `queue_timestamp` เป็นเวลาปัจจุบัน ทำให้คิวตกไปอยู่ท้ายสุดของกลุ่มที่รอ |
| `revertAuctionQueue` | แอดมิน | `id: string \| number` | ยกเลิกผลการประมูล: ปรับสถานะจาก `completed` กลับเป็น `waiting`, ลดยอด `received_qty = 0`, และสั่ง `revertRoundProgress` เพื่อคืนสิทธิ์ในรอบอัตโนมัติ |
| `batchRevertAuctionQueues` | แอดมิน | `ids: (string \| number)[]` | ย้อนคืนผลการประมูลแบบกลุ่ม รองรับทั้ง Round Logs, Round Slots และ Standard Queues พร้อมย้อนคืนสิทธิ์ให้สมาชิกทันที |
| `adminBookAuctionQueueForMember` | แอดมิน | `targetUserId: string, items: { itemType, requestedQty }[]` | แอดมินทำการจองคิวแทนสมาชิกในกิลด์ (Proxy Booking) ตรวจสอบความถูกต้องว่าอยู่กิลด์เดียวกันและไม่เกินโควตา 10 ชิ้น |
| `syncMemberAuctionQueue` | แอดมิน | `userId: string, itemType: string, qty: number` | แอดมินปรับเพิ่ม/ลดจำนวนคิวของสมาชิกคนใดคนหนึ่งให้ตรงตามตัวเลขที่กำหนด |
| `clearQueueByItemType` | แอดมิน | `itemType: ItemType` | Hard Delete ล้างคิวทั้งหมดของไอเทมนั้นในกิลด์ออกจากฐานข้อมูล (ใช้เมื่อต้องการล้างกระดานใหม่ทั้งหมด) |

---

## 5. เจาะลึก Server Actions: ระบบรอบการประมูลกิลด์ (`auction-rounds.ts`)

ไฟล์ `app/actions/auction-rounds.ts` จัดการตรรกะขั้นสูงสำหรับการหมุนเวียนรับของรางวัลให้สมาชิกทุกคนได้รับอย่างเท่าเทียม:

### 5.1 การเริ่มต้นและการจัดผังรอบ
- **`startOrConfigureRound(itemName, baseQuota, roundNumber?)`**:
  - ดึงรายชื่อสมาชิกทุกคนในกิลด์ แล้วจัดเรียงแบบ **Party Grid Order + Natural Sort** (เรียงตามปาร์ตี้หลัก `party_id` -> ช่องในปาร์ตี้ `slot_index` -> ชื่อตัวละครภาษาไทย)
  - สร้างรอบใหม่หรืออัปเดตรอบเดิมใน `auction_rounds`
  - ซิงค์สมาชิกทุกคนเข้าสู่ `auction_round_members` พร้อมคำนวณสถานะ (`pending`, `in_progress`, `completed`)
  - **Auto Re-allocate Slots**: หากในวันนั้นมี Daily Session เปิดอยู่ ระบบจะจัดสรรสล็อตลงกระดานสดวันนี้ให้ทันที
- **`batchConfigureAllRoundQuotas(quotas)`**:
  - กำหนดโควตาเป้าหมายของทั้ง 4 ไอเทมพร้อมกันในปุ่มเดียว ผ่าน RPC `batch_configure_guild_round_quotas` รวดเร็วระดับมิลลิวินาที

### 5.2 การจัดการสิทธิ์สมาชิกในรอบ
- **`transferRoundQuota(fromUserId, toUserId, itemName, transferQty, transferType, note)`**:
  - ระบบโอนสิทธิ์ระหว่างสมาชิก: ตัดโควตาผู้โอนผ่าน `transferred_out_quota` และเพิ่มให้ผู้รับผ่าน `transferred_in_quota`
  - รองรับทั้งการโอนบางส่วน (`partial`) และยกสิทธิ์ที่เหลือทั้งหมด (`full`)
  - มีการบันทึกลงทั้ง `auction_round_transfers` และ `auction_round_logs`
  - ทำการคำนวณและปรับผังสล็อตกระดานสดใหม่อัตโนมัติทันที
- **`swapRoundQueueOrder(memberId1, memberId2, reason)`**:
  - สลับตำแหน่ง `queue_order` ระหว่างสมาชิก 2 คนในรอบ พร้อมบันทึก Audit Log
- **`bulkReorderRoundQueue(roundId, orderedMemberIds, note)`**:
  - จัดเรียงลำดับคิวใหม่ทั้งชุด โดยมีกลไกตรวจสอบ Completed Members เพื่อ Offset ลำดับคิว ไม่ให้ชนกับคนที่ได้ของครบไปแล้ว
- **`skipOrDeferRoundMember(roundMemberId, reason)`**:
  - สละสิทธิ์/ข้ามคิวสมาชิกคนดังกล่าว ปรับสถานะเป็น `'skipped'` และดึงคนถัดไปขึ้นมาแทนบนกระดานสล็อตทันที

### 5.3 เทมเพลตจัดคิวล่วงหน้า (Queue Templates)
- `createQueueTemplate(name, description, memberIds)`: บันทึกเทมเพลตลำดับคิว
- `updateQueueTemplate(templateId, name, description, memberIds)`: ปรับแต่งเทมเพลต
- `deleteQueueTemplate(templateId)`: ลบเทมเพลต
- **`applyQueueTemplateToRound(roundId, templateId)`**:
  - **Exclusion Logic อัจฉริยะ:** เมื่อนำเทมเพลตมาปรับใช้ ระบบจะคัดกรองสมาชิกที่ "ได้ของครบไปแล้ว (Completed)" ออกจากคิวโดยอัตโนมัติ เพื่อป้องกันการจัดคิวซ้ำซ้อน ส่วนสมาชิกที่ไม่อยู่ในเทมเพลตจะถูกนำไปต่อท้ายตามลำดับเดิม

### 5.4 การสะสมยอดและการจบรอบ
- **`awardRoundProgress(guildId, userId, itemName, qty, adminId, note)`**:
  - เพิ่มยอด `received_qty` สะสมในรอบ ตรวจสอบไม่ให้เกิน `target_quota` เมื่อครบจะเปลี่ยนสถานะเป็น `'completed'` และอัปเดต `completed_members_count` ใน `auction_rounds`
- **`revertRoundProgress(guildId, userId, itemName, qty, adminId, note)`**:
  - ลดยอดสะสมเมื่อมีการกดยกเลิกผล ปรับสถานะจาก `completed` กลับมาเป็น `in_progress` หรือ `pending`
- **`advanceToNextRound(itemName, nextBaseQuota, rolloverIncomplete)`**:
  - ปิดรอบปัจจุบัน ปรับสถานะเป็น `'completed'`
  - **Rollover Deficit Priority (ระบบยกยอดตกหล่น):** หากเปิดใช้งาน สมาชิกที่ยังได้ของไม่ครบในรอบที่ผ่านมา จะถูกนำมาขึ้นเป็นคิวแรกๆ ของรอบใหม่ทันที พร้อมทบยอดโควตาค้างสะสม (เช่น รอบที่แล้วขาด 1 ชิ้น รอบใหม่ตั้งไว้ 2 ชิ้น สมาชิกคนนี้จะได้โควตารวม 3 ชิ้นในรอบใหม่)
- **`rollbackOrDeleteCurrentRound(itemName)`**:
  - ย้อนกลับรอบหรือลบรอบปัจจุบัน หากเป็นรอบที่มากกว่า 1 ระบบจะลบรอบปัจจุบันทิ้ง และเปิดรอบก่อนหน้ากลับมา Active ใหม่อัตโนมัติ
- **`resetAllGuildRounds()`**:
  - รีเซ็ตล้างข้อมูลรอบการประมูลของทั้งกิลด์ทิ้งทั้งหมด (Hard Reset)

---

## 6. กลไกการคำนวณและจัดสรรสล็อต (Slot Allocation & Rendering Engine)

ในคอมโพเนนต์ `components/auction/index.tsx` มีฟังก์ชัน `useMemo` ที่ทำหน้าที่เป็นสมองกลในการสร้างรายการสล็อต (`boardSlots`, `waitlistSlots`, `rawSlots`) โดยรองรับทั้ง 2 โหมด:

```
[ ตรวจสอบเซสชันวันนี้ (todayItems) ]
                 |
        มี Active Round หรือไม่?
        /                      \
      (มี)                    (ไม่มี)
       |                         |
       v                         v
+-----------------------+ +-----------------------+
|      ROUND MODE       | |   SELF-BOOKING MODE   |
+-----------------------+ +-----------------------+
| 1. รวบรวมยอดที่ได้รับ | | 1. รวมคิวของสมาชิก    |
|    เฉพาะในวันนี้      | |    (auction_queues)   |
| 2. คำนวณ Remaining    | | 2. กรองตาม Limit      |
|    For Today          | |    ของแต่ละคน         |
| 3. แยก Phase สล็อต:   | | 3. จัดกลุ่ม Session   |
|    - Phase 1: เคลียร์ | |    ตาม Timestamp      |
|      ยอดค้างรอบเก่า   | | 4. เรียงคิวแบบ FIFO   |
|      (Deficit First)  | | 5. สร้างสล็อตตามลำดับ |
|    - Phase 2: โควตา   | +-----------------------+
|      รอบปัจจุบัน      |            |
| 4. จัดเรียงสล็อตเข้าผัง |            |
+-----------------------+            |
       |                             |
       +--------------+--------------+
                      |
                      v
      [ เทียบกับ Daily Total Quantity ]
         /                         \
(ลำดับ <= Total Qty)        (ลำดับ > Total Qty)
        |                           |
        v                           v
  [ BOARD SLOTS ]            [ WAITLIST SLOTS ]
(แสดงบนกระดานสดหน้า 1..N)    (แสดงในรายชื่อรอคิว)
```

### รายละเอียด Phase 1 vs Phase 2 ใน Round Mode:
1. **Phase 1 (Deficit Clearance)**: สมาชิกที่ได้รับการทบยอดมาจากรอบก่อนหน้า สล็อตในส่วนที่ค้างจะถูกกำหนดเป็น Phase 1 และถูกจัดสรรลงกระดานก่อนสมาชิกทั่วไปเสมอ เพื่อชดเชยสิทธิ์ที่ตกหล่น
2. **Phase 2 (Current Round Quota)**: สล็อตของรอบปัจจุบัน จะถูกจัดสรรตามลำดับ `queue_order` ปกติ
3. **Empty Slots Fill**: หากจำนวนสล็อตที่จัดสรรยังไม่เต็มยอด `total_quantity` ของวันนี้ ระบบจะสร้างสล็อตจำลอง `--- สล็อตว่าง ---` ให้ครบตามจำนวนหน้า

---

## 7. หน้าต่างแสดงผลและการควบคุม UI (AuctionWindow & 6 View Modes)

ไฟล์ `components/auction/AuctionWindow.tsx` เป็นศูนย์กลางการควบคุมกระดานประมูลของผู้ใช้และแอดมิน โดยรองรับ **6 โหมดมุมมอง (View Modes)**:

```
+---------------------------------------------------------------------------------+
|                                 AUCTION WINDOW                                  |
|  [ โหมดรอบกิลด์ / โหมดจองเอง ]  [ รีเฟรชข้อมูล ]  [ แคปเจอร์ภาพผังกระดาน ]       |
+---------------------------------------------------------------------------------+
| TAB NAVIGATION:                                                                 |
| [1. สล็อตประจำวัน] [2. รอบกิลด์] [3. สรุปคิว] [4. รายการคิว] [5. ประวัติ] [6. จองแทน] |
+---------------------------------------------------------------------------------+
```

### 7.1 โหมด "สล็อตประจำวัน" (`viewMode === 'slots'`)
- แสดงกระดานสล็อตแบบกริด แบ่งหน้าละ 4 สล็อต (`slotsPerPage = 4`)
- สามารถกรองแถบไอเทมย่อยได้: ทั้งหมด, สมุดการ์ด, เศษบอส, หรือ ขนนก (รวมขาว+ดำแดง)
- แต่ละสล็อตแสดง:
  - ชื่อผู้ได้รับ, UID เกม, ไอคอนไอเทม, และรอบที่เท่าไหร่
  - ป้ายสถานะสีสันสวยงาม: `รอรับของ` (สีเหลือง), `ประมูลสำเร็จ` (สีเขียว)
  - **Batch Selection Checkbox**: แอดมินสามารถคลิกเลือกหลายๆ สล็อตพร้อมกัน แล้วกดยืนยันบันทึกผลการประมูลรอบเดียว (`batchAwardAuctionQueues`)
  - **ปุ่มประมูลรายช่อง**: กดแจกทันทีทีละช่อง พร้อมระบบ Optimistic Update (`confirmedSlots`) ไม่ทำให้หน้าจอกระพริบ
  - **Export Image**: ปุ่มแคปเจอร์ภาพกระดานสล็อตเป็นไฟล์ PNG ส่งลง Discord / LINE ได้ทันที

### 7.2 โหมด "รอบการประมูลกิลด์" (`viewMode === 'rounds'`)
- แสดงความคืบหน้าของรอบทั้ง 4 ไอเทม:
  - Header แสดงรอบปัจจุบัน, โควตาต่อคน, จำนวนสมาชิกที่ได้ครบแล้ว (`completed / total`)
  - แถบความคืบหน้าภาพรวม (Progress Bar)
  - แถบสมาชิกแยก 3 แท็บ: **กำลังรอคิว (Waiting)**, **ได้รับแล้ว (Completed)**, และ **ประวัติบันทึก (Logs)**
  - การจัดการสมาชิกแต่ละคน: ปุ่มมอบรางวัลโดยตรง, ปุ่มโอนสิทธิ์, ปุ่มสละสิทธิ์
  - ปุ่มเครื่องมือแอดมิน: จัดเรียงคิว (Reorder), สลับคิว (Swap), เทมเพลต (Templates), ตั้งค่าโควตารอบ (Settings), และจบรอบขึ้นรอบใหม่ (Advance)

### 7.3 โหมด "สรุปยอดการจอง" (`viewMode === 'summary'`)
- แสดงผลในรูปแบบ Matrix Table (`QueueSummaryTable.tsx`)
- สรุปยอดจองและยอดที่ได้รับของสมาชิกทุกคนในกิลด์ เรียงตามปาร์ตี้ ครบทั้ง 4 ไอเทมในหน้าเดียว
- มีแถบสรุปยอดรวมด้านบน (Total Requested vs Total Received)

### 7.4 โหมด "รายการคิวทั้งหมด" (`viewMode === 'queue'`)
- แสดงรายการแถวคิวแบบละเอียด (List View)
- แสดงวันที่จอง, เวลา, จำนวนที่ขอรับ, สถานะ
- แอดมินสามารถกดแก้ไขจำนวน หรือลบคิวที่ผิดพลาดได้

### 7.5 โหมด "ประวัติการประมูล" (`viewMode === 'history'`)
- รวมประวัติทั้งจากการประมูลบนกระดาน และประวัติจากรอบกิลด์
- ช่องค้นหาชื่อสมาชิก / UID เกม
- ตัวกรองแยกตามประเภทไอเทม
- ระบบแบ่งหน้า (Pagination)
- **Batch Revert**: แอดมินสามารถติ๊กเลือกหลายประวัติเพื่อกดยกเลิกและย้อนคืนสิทธิ์พร้อมกัน

### 7.6 โหมด "จองแทนสมาชิก" (`viewMode === 'proxy'`)
- หน้าต่างสำหรับหัวกิลด์/แอดมิน กรอกจองคิวแทนสมาชิก (`AdminProxyBooking.tsx`)
- ค้นหาสมาชิกในกิลด์ กำหนดจำนวนไอเทมทั้ง 4 ชนิด แล้วกดบันทึกแทนสมาชิกได้ทันที

---

## 8. ระบบ Modal ควบคุมของแอดมิน (Admin Modals & Advanced Tools)

ระบบมี Modal พิเศษสำหรับการจัดการเชิงลึก:

### 8.1 `AdminRoundSettingsModal.tsx` (ตั้งค่าโควตา & จบรอบ)
- **โหมดตั้งค่า (Settings Mode)**:
  - ปรับโควตาเป้าหมายของทั้ง 4 ไอเทมพร้อมกันในหน้าต่างเดียว
  - **Danger Zone**: ปุ่มลบ/รีเซ็ตรอบเฉพาะไอเทม (Rollback to previous round) และปุ่มรีเซ็ตรอบทั้งหมดของกิลด์ (Full Guild Reset)
- **โหมดจบรอบ (Advance Mode)**:
  - กำหนดโควตาสำหรับรอบถัดไป
  - ตัวเลือกติ๊กถูก **"ยกยอดสมาชิกที่ตกหล่น (Rollover Priority)"**

### 8.2 `AdminTransferModal.tsx` (โอนสิทธิ์และโควตา)
- เลือกสมาชิกต้นทาง (ผู้โอน) และสมาชิกปลายทาง (ผู้รับ)
- เลือกระบุจำนวนชิ้นที่ต้องการโอน หรือโอนสิทธิ์ทั้งหมดที่เหลือ
- บันทึกหมายเหตุการโอนเพื่อเก็บเป็นหลักฐานใน Audit Log

### 8.3 `AdminSwapModal.tsx` (สลับคิว)
- เลือกสมาชิก 2 คนที่ต้องการสลับตำแหน่งลำดับคิวในรอบ
- บันทึกเหตุผลการสลับ

### 8.4 `AdminReorderModal.tsx` (จัดเรียงคิวใหม่ทั้งชุด)
- แสดงรายชื่อสมาชิกในรอบทั้งหมด
- สามารถลากจัดลำดับคิวได้อิสระ หรือกดปุ่ม **"จัดเรียงตามผังปาร์ตี้อัตโนมัติ (Party Grid Order)"**
- บันทึกการจัดลำดับใหม่ทั้งหมดในคำสั่งเดียว

### 8.5 `AdminQueueTemplateModal.tsx` (จัดการเทมเพลต)
- สร้างเทมเพลตใหม่ บันทึกรายชื่อสมาชิกตามลำดับที่ต้องการ
- แก้ไข/ลบเทมเพลต
- กด **"นำเทมเพลตนี้ไปจัดคิว"** เข้าสู่รอบการประมูลปัจจุบัน

---

## 9. การทำงานแบบ Realtime และ Caching (0ms Tab Switch & WebSocket)

เพื่อประหยัด Quota ของ Vercel และ Supabase (Free Tier) ตามข้อกำหนดใน `GEMINI.md`:

1. **ห้าม Polling Loop เด็ดขาด**:
   - ใน `components/auction/index.tsx` กำหนด `refetchInterval: false` บน React Query
   - ใช้ **Supabase Realtime Channel (`auction_realtime_board`)** ดักจับ Event Postgres Changes บนตาราง:
     - `auction_rounds`
     - `auction_round_members`
     - `auction_round_transfers`
     - `auction_round_logs`
     - `auction_queues`
   - เมื่อมีการอัปเดตข้อมูลจากเครื่องอื่น ระบบจะสั่ง Trigger ผ่าน Debounce 200ms เพื่อป้องกันการยิง Request ซ้ำซ้อน
2. **In-Memory Cache (0ms Tab Switching)**:
   - ข้อมูลของรอบแต่ละไอเทมถูกเก็บลงใน `roundCacheRef` ในระดับ Client Component
   - เมื่อผู้ใช้กดสลับแท็บระหว่าง Album -> Puppet -> White -> RedBlack หน้าจอจะเปลี่ยนทันที 0ms โดยไม่ต้องรอ Loading Spinner
3. **Optimistic Updates**:
   - เมื่อแอดมินกดมอบรางวัลบนกระดานสล็อต สถานะจะเปลี่ยนเป็นสีเขียวทันทีผ่าน State `confirmedSlots` ก่อนที่ Network Request จะตอบกลับ

---

## 10. สรุปกฎเกณฑ์ทางธุรกิจและความปลอดภัย (Business Rules & Security Guards)

1. **โควตาสูงสุดของระบบคิวปกติ**:
   - สมาชิก 1 คน ไม่สามารถมีคิวสถานะรอรับรวมเกิน **10 ชิ้นต่อประเภทไอเทม**
2. **การป้องกัน Race Condition**:
   - การแจกของรางวัลผ่าน RPC `process_award_auction_slot` และ `batch_award_auction_slots` ทำงานในระดับ Row-level Locking ป้องกันการกดแจกซ้ำในเสี้ยววินาทีเดียวกัน
3. **การป้องกันแจกเกินโควตา (Cap Protection)**:
   - ฟังก์ชัน `awardRoundProgress` ตรวจสอบยอดคงเหลือจริง หากสมาชิกได้รับครบโควตาสุทธิ (`target_quota`) แล้ว จะไม่สามารถมอบรางวัลเพิ่มในรอบนั้นได้
4. **การเชื่อมโยงสองระบบ (Auto-Link)**:
   - เมื่อแอดมินกดแจกรางวัลบนกระดานสด ระบบจะไปอัปเดตความคืบหน้าในรอบกิลด์ให้ทันที
   - เมื่อแอดมินกดยกเลิกผลบนกระดานสด ระบบจะไปย้อนคืนสิทธิ์ในรอบกิลด์ให้อัตโนมัติ
5. **Row Level Security (RLS)**:
   - สมาชิกทุกคนในกิลด์มีสิทธิ์อ่าน (SELECT) ข้อมูลของกิลด์ตนเองเท่านั้น
   - เฉพาะผู้ใช้ที่มี Role `'admin'` ในกิลด์เดียวกันเท่านั้นที่สามารถสร้าง แก้ไข หรือลบข้อมูลในระบบประมูลได้

---
*เอกสารนี้ถูกรวบรวมและสร้างขึ้นจากโค้ดจริงของระบบ ROOC Management เพื่อใช้เป็นคู่มืออ้างอิงและพัฒนาต่อยอดอย่างเป็นทางการ*

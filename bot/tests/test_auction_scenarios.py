import os
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

# ตั้งค่า dummy env เพื่อให้ import โมดูลของบอทได้โดยไม่ต้องต่อ DB จริงตอนรัน Unit Test
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "dummy-service-key")
os.environ.setdefault("DISCORD_BOT_TOKEN", "dummy-token")

# เพิ่มโฟลเดอร์ bot เข้า sys.path
BOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BOT_DIR not in sys.path:
    sys.path.insert(0, BOT_DIR)

from services import allocation_service
from cogs.auction import (
    AuctionCog,
    SetItemsPart1Modal,
    SetItemsPart2Modal,
    parse_qty_and_limit,
    recalculate_continuous_sessions,
)
from views.attendance_view import ITEM_LABELS, EventPollView


class TestAuctionMultiUserScenarios(unittest.IsolatedAsyncioTestCase):
    """
    ชุดทดสอบจำลองสถานการณ์ผู้เล่นหลายคน (Multi-User Simulation & Unit Tests)
    ไม่ต้องสมัคร Discord หลายบัญชีเพื่อทดสอบเอง
    """

    def test_scenario_1_fewer_members_than_items_respects_personal_limit(self):
        """
        กรณีที่ 1: มีของมากกว่าจำนวนคนที่ขอ (สมุดการ์ด 10 ชิ้น, ลิมิต 2/คน, มีคนขอ 3 คน)
        ผลลัพธ์ที่ต้องได้: ทุกคนได้คนละ 2 ชิ้นตามลิมิต (รวมแจก 6 ชิ้น) ไม่แจกเกินลิมิตต่อคน
        """
        members = [
            {"user_id": "u1", "display_name": "PlayerOne", "discord_id": "1001"},
            {"user_id": "u2", "display_name": "PlayerTwo", "discord_id": "1002"},
            {"user_id": "u3", "display_name": "PlayerThree", "discord_id": "1003"},
        ]
        credit_map = {"u1": 0, "u2": 0, "u3": 0}

        slots = allocation_service.allocate_slots(
            item_type="Album",
            total_qty=10,
            personal_limit=2,
            start_page=1,
            start_slot=1,
            members=members,
            credit_map=credit_map,
        )

        self.assertEqual(len(slots), 6, "ควรจัดสรรรวม 6 ชิ้น (3 คน x ลิมิต 2 ชิ้น)")
        count_by_user = {}
        for s in slots:
            count_by_user[s["user_id"]] = count_by_user.get(s["user_id"], 0) + 1

        self.assertEqual(count_by_user, {"u1": 2, "u2": 2, "u3": 2})
        # ตรวจสอบพิกัดหน้า/ช่อง (6 ชิ้น = Page 1 ช่อง 1-4 และ Page 2 ช่อง 1-2)
        coords = [(s["page"], s["slot"]) for s in slots]
        self.assertEqual(coords, [(1, 1), (1, 2), (1, 3), (1, 4), (2, 1), (2, 2)])
        self.assertTrue(all(s["total_pages"] == 2 for s in slots))

    def test_scenario_2_exact_division_among_members(self):
        """
        กรณีที่ 2: จำนวนของหารลงตัวพอดีกับจำนวนคนขอ (ขนนกขาว 8 ชิ้น, ลิมิต 2/คน, คนขอ 4 คน)
        ผลลัพธ์ที่ต้องได้: ทุกคนได้คนละ 2 ชิ้นเท่ากันเป๊ะ เต็ม 2 หน้าพอดี (8 ช่อง)
        """
        members = [
            {"user_id": f"u{i}", "display_name": f"Member{i}", "discord_id": f"200{i}"}
            for i in range(1, 5)
        ]
        credit_map = {}

        slots = allocation_service.allocate_slots(
            item_type="White",
            total_qty=8,
            personal_limit=2,
            start_page=1,
            start_slot=1,
            members=members,
            credit_map=credit_map,
        )

        self.assertEqual(len(slots), 8)
        for i in range(1, 5):
            user_slots = [s for s in slots if s["user_id"] == f"u{i}"]
            self.assertEqual(len(user_slots), 2)
        self.assertEqual((slots[-1]["page"], slots[-1]["slot"]), (2, 4))

    def test_scenario_3_remainder_distributed_by_carry_credit_priority(self):
        """
        กรณีที่ 3: ของมีเศษเหลือ ทดสอบการลัดคิวด้วย Carry Credit
        (เศษการ์ดบอส 6 ชิ้น, ลิมิต 2/คน, มีคนขอ 4 คน:
         - u1 ลงชื่อคนแรก แต่ Credit = 0
         - u2 ลงชื่อคนที่สอง Credit = 3
         - u3 ลงชื่อคนที่สาม Credit = 1
         - u4 ลงชื่อคนที่สี่ Credit = 0)
        ผลลัพธ์ที่ต้องได้:
         - ทุกคนได้ฐานคนละ 1 ชิ้น (4 ชิ้น)
         - เศษอีก 2 ชิ้นต้องตกเป็นของ u2 (Credit 3) และ u3 (Credit 1)
         - สรุป: u2 ได้ 2 ชิ้น, u3 ได้ 2 ชิ้น, u1 ได้ 1 ชิ้น, u4 ได้ 1 ชิ้น
        """
        members = [
            {"user_id": "u1", "display_name": "EarlyNoCredit", "discord_id": "3001"},
            {"user_id": "u2", "display_name": "HighCredit3", "discord_id": "3002"},
            {"user_id": "u3", "display_name": "MidCredit1", "discord_id": "3003"},
            {"user_id": "u4", "display_name": "LateNoCredit", "discord_id": "3004"},
        ]
        credit_map = {"u1": 0, "u2": 3, "u3": 1, "u4": 0}

        slots = allocation_service.allocate_slots(
            item_type="Puppet",
            total_qty=6,
            personal_limit=2,
            start_page=1,
            start_slot=1,
            members=members,
            credit_map=credit_map,
        )

        self.assertEqual(len(slots), 6)
        count_by_user = {}
        for s in slots:
            count_by_user[s["user_id"]] = count_by_user.get(s["user_id"], 0) + 1

        self.assertEqual(count_by_user["u2"], 2, "u2 (Credit 3) ต้องได้ 2 ชิ้น")
        self.assertEqual(count_by_user["u3"], 2, "u3 (Credit 1) ต้องได้ 2 ชิ้น")
        self.assertEqual(count_by_user["u1"], 1, "u1 (Credit 0) ต้องได้ 1 ชิ้น")
        self.assertEqual(count_by_user["u4"], 1, "u4 (Credit 0) ต้องได้ 1 ชิ้น")
        # คนที่มี Credit สูงสุด (u2) ต้องได้รับสล็อตแรกสุด (Page 1 Slot 1-2)
        self.assertEqual(slots[0]["user_id"], "u2")
        self.assertEqual(slots[1]["user_id"], "u2")

    def test_scenario_4_fewer_items_than_members(self):
        """
        กรณีที่ 4: ของมีน้อยกว่าจำนวนคนขอ (ขนนกดำแดง 2 ชิ้น, ลิมิต 1/คน, คนขอ 5 คน)
        - u3 มี Credit = 2
        - คนอื่น Credit = 0 ทั้งหมด (u1 ลงชื่อก่อน u2, u4, u5)
        ผลลัพธ์ที่ต้องได้:
        - u3 (Credit สูงสุด) ได้ชิ้นที่ 1
        - u1 (Credit เท่ากันแต่ลงชื่อคนแรก) ได้ชิ้นที่ 2
        - u2, u4, u5 ไม่ได้ของในรอบนี้ (รวมแจก 2 ชิ้นพอดี)
        """
        members = [
            {"user_id": f"u{i}", "display_name": f"User{i}", "discord_id": f"400{i}"}
            for i in range(1, 6)
        ]
        credit_map = {"u3": 2}

        slots = allocation_service.allocate_slots(
            item_type="RedBlack",
            total_qty=2,
            personal_limit=1,
            start_page=3,
            start_slot=3,
            members=members,
            credit_map=credit_map,
        )

        self.assertEqual(len(slots), 2)
        winners = [s["user_id"] for s in slots]
        self.assertEqual(winners, ["u3", "u1"])
        # เริ่มที่ Page 3 ช่อง 3 -> ชิ้นที่สองอยู่ Page 3 ช่อง 4
        self.assertEqual((slots[0]["page"], slots[0]["slot"]), (3, 3))
        self.assertEqual((slots[1]["page"], slots[1]["slot"]), (3, 4))

    def test_scenario_5_continuous_multi_item_coordinates(self):
        """
        กรณีที่ 6: ตั้งค่าไอเทมทั้ง 4 ชนิดพร้อมกัน และคำนวณพิกัดหน้า/ช่องต่อเนื่องกันอัตโนมัติ
        - Album: 5 ชิ้น (ลิมิต 2) -> Page 1:1 ถึง 2:1
        - Puppet: 3 ชิ้น (ลิมิต 1) -> Page 2:2 ถึง 2:4
        - White: 0 ชิ้น (ไม่มีไอเทม) -> ข้าม
        - RedBlack: 2 ชิ้น (ลิมิต 1) -> Page 3:1 ถึง 3:2
        """
        config = {
            "Album": {"mode": "qty", "total_quantity": 5, "personal_limit": 2},
            "Puppet": {"mode": "qty", "total_quantity": 3, "personal_limit": 1},
            "White": {"mode": "qty", "total_quantity": 0, "personal_limit": 1},
            "RedBlack": {"mode": "qty", "total_quantity": 2, "personal_limit": 1},
        }

        rows = recalculate_continuous_sessions(
            event_name="กิลลีค",
            session_date="2026-09-30",
            items_config=config,
            current_status="closed",
        )
        by_type = {r["item_type"]: r for r in rows}

        self.assertEqual(
            (by_type["Album"]["start_page"], by_type["Album"]["start_slot"], by_type["Album"]["end_page"], by_type["Album"]["end_slot"]),
            (1, 1, 2, 1),
        )
        self.assertEqual(
            (by_type["Puppet"]["start_page"], by_type["Puppet"]["start_slot"], by_type["Puppet"]["end_page"], by_type["Puppet"]["end_slot"]),
            (2, 2, 2, 4),
        )
        self.assertEqual(by_type["White"]["total_quantity"], 0)
        self.assertEqual(
            (by_type["RedBlack"]["start_page"], by_type["RedBlack"]["start_slot"], by_type["RedBlack"]["end_page"], by_type["RedBlack"]["end_slot"]),
            (3, 1, 3, 2),
        )
        self.assertTrue(all(r["status"] == "closed" for r in rows))

    def test_scenario_6_two_input_parser_and_discord_modal_limits(self):
        """
        ตรวจสอบการแปลงข้อมูลแบบแยก 2 ช่อง (จำนวน และ ลิมิต) โดยไม่ต้องใช้ลูกน้ำ ,
        และตรวจสอบว่าความยาว Label ทุกช่องใน Modal ไม่เกิน 45 ตัวอักษรตามกฎ Discord API
        """
        # กรอกตัวเลขแยกช่องปกติ
        mode, sp, ss, ep, es, qty, limit = parse_qty_and_limit("15", "2")
        self.assertEqual((mode, qty, limit), ("qty", 15, 2))

        # กรอกพิกัดในช่องแรก และลิมิตในช่องที่สอง
        mode2, sp2, ss2, ep2, es2, qty2, limit2 = parse_qty_and_limit("1:1-2:4", "3")
        self.assertEqual((mode2, sp2, ss2, ep2, es2, qty2, limit2), ("coord", 1, 1, 2, 4, 8, 3))

        # ตรวจสอบความยาว Title และ Label ของ SetItemsPart1Modal และ SetItemsPart2Modal
        m1 = SetItemsPart1Modal("กิลลีคชื่อยาวมากทดสอบระบบประมูลกิลด์", "2026-09-30", {})
        m2 = SetItemsPart2Modal("กิลลีคชื่อยาวมากทดสอบระบบประมูลกิลด์", "2026-09-30", {})

        self.assertLessEqual(len(m1.title), 45)
        self.assertLessEqual(len(m2.title), 45)

        for modal in (m1, m2):
            for child in modal.children:
                self.assertLessEqual(
                    len(child.label),
                    45,
                    f"Label '{child.label}' ยาวเกิน 45 ตัวอักษร ({len(child.label)} ตัว)",
                )

        # ตรวจสอบว่าไม่มีอิโมจิใน ITEM_LABELS
        for lbl in ITEM_LABELS.values():
            self.assertTrue(all(ord(ch) < 0x1F000 for ch in lbl), f"พบอิโมจิใน {lbl}")

    async def test_scenario_7_must_close_poll_before_announce_allocation(self):
        """
        ตรวจสอบเงื่อนไขบังคับ: ต้องปิดโหวตก่อน (status == 'closed') จึงจะประกาศผล /announce_allocation ได้
        - ถ้ารอบยังเป็น status == 'active' -> บอทต้องปฏิเสธและแจ้งให้ปิดโหวตก่อน
        - ถ้ารอบเป็น status == 'closed' -> บอทคำนวณและส่งข้อความประกาศผลลงห้องแชทได้สำเร็จ
        """
        bot = MagicMock()
        cog = AuctionCog(bot)

        interaction = MagicMock()
        interaction.user.id = 999999
        interaction.user.display_name = "AdminGarfield"
        interaction.response.defer = AsyncMock()
        interaction.response.is_done = MagicMock(return_value=True)
        interaction.followup.send = AsyncMock()

        channel = MagicMock()
        channel.mention = "#แจ้งวอร์"
        channel.send = AsyncMock()

        # 1) กรณีที่ยังไม่ได้ปิดโหวต (status == 'active')
        active_sessions = [
            {
                "event_name": "กิลลีค",
                "session_date": "2026-09-30",
                "item_type": "Album",
                "start_page": 1,
                "start_slot": 1,
                "end_page": 1,
                "end_slot": 4,
                "total_quantity": 4,
                "personal_limit": 2,
                "status": "active",
            }
        ]

        mock_query_active = MagicMock()
        mock_query_active.execute.return_value = MagicMock(data=active_sessions)

        with patch("cogs.auction.auction_service.get_profile_by_discord_id", new=AsyncMock(return_value={"id": "admin1", "role": "admin"})), \
             patch("cogs.auction.supabase.table") as mock_table:
            mock_table.return_value.select.return_value.eq.return_value.eq.return_value = mock_query_active

            await cog.announce_allocation.callback(cog, interaction, channel, "กิลลีค|2026-09-30")

            # ต้องไม่ส่งประกาศลงห้องแชท และต้องแจ้งเตือนให้ปิดโหวตก่อน
            channel.send.assert_not_called()
            sent_msg = interaction.followup.send.call_args[0][0]
            self.assertIn("ยังไม่ได้ปิดโหวต", sent_msg)

        # 2) กรณีที่ปิดโหวตแล้ว (status == 'closed') และมีสมาชิก 3 คนขอประมูล
        interaction.followup.send.reset_mock()
        channel.send.reset_mock()

        closed_sessions = [
            {
                "event_name": "กิลลีค",
                "session_date": "2026-09-30",
                "item_type": "Album",
                "start_page": 1,
                "start_slot": 1,
                "end_page": 1,
                "end_slot": 4,
                "total_quantity": 4,
                "personal_limit": 2,
                "status": "closed",
            }
        ]
        mock_attendees = [
            {"user_id": "u1", "display_name": "KnightA", "discord_id": "111"},
            {"user_id": "u2", "display_name": "PriestB", "discord_id": "222"},
            {"user_id": "u3", "display_name": "WizardC", "discord_id": "333"},
        ]

        mock_sessions_q = MagicMock()
        mock_sessions_q.execute.return_value = MagicMock(data=closed_sessions)

        mock_nobid_q = MagicMock()
        mock_nobid_q.execute.return_value = MagicMock(data=[])

        def table_side_effect(table_name):
            t = MagicMock()
            if table_name == "event_sessions":
                t.select.return_value.eq.return_value.eq.return_value = mock_sessions_q
            elif table_name == "event_attendance":
                t.select.return_value.eq.return_value.eq.return_value.eq.return_value = mock_nobid_q
            return t

        with patch("cogs.auction.auction_service.get_profile_by_discord_id", new=AsyncMock(return_value={"id": "admin1", "role": "admin"})), \
             patch("cogs.auction.supabase.table", side_effect=table_side_effect), \
             patch("cogs.auction.allocation_service.get_event_attendees", new=AsyncMock(return_value=mock_attendees)), \
             patch("cogs.auction.allocation_service.get_credit_map", new=AsyncMock(return_value={"u1": 0, "u2": 2, "u3": 0})), \
             patch("cogs.auction.allocation_service.save_allocation", new=AsyncMock()):

            await cog.announce_allocation.callback(cog, interaction, channel, "กิลลีค|2026-09-30")

            # ต้องส่งทั้ง Embed สรุป และข้อความพิกัดรายบุคคลลงห้องแชท
            self.assertEqual(channel.send.call_count, 2)
            announced_text = channel.send.call_args_list[1][0][0]
            # u2 มี credit 2 จึงได้ 2 ชิ้น (Page 1/1: 1, 2), u1 ได้ 1 ชิ้น (3), u3 ได้ 1 ชิ้น (4)
            self.assertIn("<@222> | กิลลีค: 2026-09-30\nPage 1/1: 1, 2", announced_text)
            self.assertIn("<@111> | กิลลีค: 2026-09-30\nPage 1/1: 3", announced_text)
            self.assertIn("<@333> | กิลลีค: 2026-09-30\nPage 1/1: 4", announced_text)


if __name__ == "__main__":
    unittest.main(verbosity=2)

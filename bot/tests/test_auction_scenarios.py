import os
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "dummy-service-key")
os.environ.setdefault("DISCORD_BOT_TOKEN", "dummy-token")

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
from views.attendance_view import ITEM_LABELS


class TestAuctionMultiUserScenarios(unittest.IsolatedAsyncioTestCase):
    """
    ชุดทดสอบจำลองสถานการณ์ผู้เล่นหลายคน (Multi-User Simulation & Unit Tests)
    """

    def test_scenario_1_fewer_members_than_items_respects_personal_limit(self):
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

        self.assertEqual(len(slots), 6)
        count_by_user = {}
        for s in slots:
            count_by_user[s["user_id"]] = count_by_user.get(s["user_id"], 0) + 1

        self.assertEqual(count_by_user, {"u1": 2, "u2": 2, "u3": 2})

    def test_scenario_2_exact_division_among_members(self):
        members = [
            {"user_id": f"u{i}", "display_name": f"Member{i}", "discord_id": f"200{i}"}
            for i in range(1, 5)
        ]
        slots = allocation_service.allocate_slots(
            item_type="White",
            total_qty=8,
            personal_limit=2,
            start_page=1,
            start_slot=1,
            members=members,
            credit_map={},
        )
        self.assertEqual(len(slots), 8)

    def test_scenario_3_carry_credit_gives_more_items_next_round(self):
        """
        กรณีที่ 3: สมาชิกเข้าร่วมวอร์แต่ไม่ประมูลวันนี้ (no_bid) สะสม Carry Credit ไว้
        เมื่อต้องการประมูลในครั้งถัดไป จะได้รับจำนวนชิ้นมากกว่าคนอื่นตามยอดสะสมที่ทบมา
        """
        members = [
            {"user_id": "PlayerB", "display_name": "PlayerB", "discord_id": "3002"},
            {"user_id": "PlayerA", "display_name": "PlayerA", "discord_id": "3001"},
            {"user_id": "PlayerC", "display_name": "PlayerC", "discord_id": "3003"},
        ]
        # PlayerA มียอดสะสม 1 ชิ้นจากรอบก่อน
        credit_map = {"PlayerA": 1, "PlayerB": 0, "PlayerC": 0}

        # รอบนี้มีสมุดการ์ด 4 ชิ้น, ลิมิตต่อคนของรอบนี้ = 1 ชิ้น
        slots = allocation_service.allocate_slots(
            item_type="Album",
            total_qty=4,
            personal_limit=1,
            start_page=1,
            start_slot=1,
            members=members,
            credit_map=credit_map,
        )

        self.assertEqual(len(slots), 4)
        count_by_user = {}
        for s in slots:
            count_by_user[s["user_id"]] = count_by_user.get(s["user_id"], 0) + 1

        self.assertEqual(count_by_user["PlayerA"], 2, "PlayerA ต้องได้ 2 ชิ้น (ทบ 1 + รอบนี้ 1)")
        self.assertEqual(count_by_user["PlayerB"], 1, "PlayerB ต้องได้ 1 ชิ้น")
        self.assertEqual(count_by_user["PlayerC"], 1, "PlayerC ต้องได้ 1 ชิ้น")


if __name__ == "__main__":
    unittest.main(verbosity=2)

from datetime import date
from services.supabase_client import supabase
from services import credit_service


# ─── Profile ────────────────────────────────────────────────────────────────

async def get_profile_by_discord_id(discord_id: str) -> dict | None:
    """ดึงข้อมูล profile จาก discord_id"""
    try:
        result = (
            supabase.table("profiles")
            .select("*")
            .eq("discord_id", str(discord_id))
            .execute()
        )
        if result.data:
            return result.data[0]
        return None
    except Exception as e:
        print(f"[auction_service] get_profile_by_discord_id error: {e}")
        return None


# ─── Round ──────────────────────────────────────────────────────────────────

async def create_round(
    item_type: str,
    total_qty: int,
    personal_limit: int,
    channel_id: str,
    created_by_discord_id: str,
    round_date: date | None = None,
) -> dict | None:
    """สร้างรอบประมูลใหม่"""
    try:
        profile = await get_profile_by_discord_id(created_by_discord_id)
        if not profile:
            return None

        rd = round_date.isoformat() if round_date else date.today().isoformat()

        result = supabase.table("auction_rounds").insert(
            {
                "round_date": rd,
                "item_type": item_type,
                "total_quantity": total_qty,
                "personal_limit": personal_limit,
                "channel_id": str(channel_id),
                "status": "voting",
                "created_by": profile["id"],
            }
        ).execute()

        if result.data:
            return result.data[0]
        return None
    except Exception as e:
        print(f"[auction_service] create_round error: {e}")
        return None


async def get_active_round() -> dict | None:
    """ดึงรอบที่กำลัง active (voting หรือ bidding)"""
    try:
        result = (
            supabase.table("auction_rounds")
            .select("*")
            .in_("status", ["voting", "bidding"])
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]
        return None
    except Exception as e:
        print(f"[auction_service] get_active_round error: {e}")
        return None


async def update_round_message_id(round_id: str, vote_message_id: str) -> bool:
    """บันทึก vote_message_id ลง round"""
    try:
        supabase.table("auction_rounds").update(
            {"vote_message_id": str(vote_message_id)}
        ).eq("id", round_id).execute()
        return True
    except Exception as e:
        print(f"[auction_service] update_round_message_id error: {e}")
        return False


async def update_round_result_message_id(round_id: str, result_message_id: str) -> bool:
    """บันทึก result_message_id ลง round"""
    try:
        supabase.table("auction_rounds").update(
            {"result_message_id": str(result_message_id)}
        ).eq("id", round_id).execute()
        return True
    except Exception as e:
        print(f"[auction_service] update_round_result_message_id error: {e}")
        return False


async def close_voting(round_id: str) -> bool:
    """เปลี่ยน status จาก voting -> bidding"""
    try:
        supabase.table("auction_rounds").update(
            {"status": "bidding"}
        ).eq("id", round_id).execute()
        return True
    except Exception as e:
        print(f"[auction_service] close_voting error: {e}")
        return False


# ─── Votes ──────────────────────────────────────────────────────────────────

async def save_vote(round_id: str, discord_id: str, vote: str) -> tuple[bool, str]:
    """
    บันทึก/อัปเดตการโหวต
    - ถ้าโหวต no_bid ให้เพิ่ม credit
    - ถ้าเปลี่ยนจาก no_bid เป็นอย่างอื่น ให้หัก credit กลับ
    """
    try:
        profile = await get_profile_by_discord_id(discord_id)
        if not profile:
            return False, "ไม่พบข้อมูลผู้ใช้ กรุณา /register ก่อน"

        user_id = profile["id"]

        # ดึงรอบเพื่อรู้ item_type และ personal_limit
        round_result = (
            supabase.table("auction_rounds")
            .select("item_type, personal_limit")
            .eq("id", round_id)
            .execute()
        )
        if not round_result.data:
            return False, "ไม่พบรอบประมูล"

        round_data = round_result.data[0]
        item_type = round_data["item_type"]
        personal_limit = round_data["personal_limit"]

        # ดึงโหวตเก่า (ถ้ามี)
        existing_vote = (
            supabase.table("round_votes")
            .select("id, vote")
            .eq("round_id", round_id)
            .eq("user_id", user_id)
            .execute()
        )

        old_vote = existing_vote.data[0]["vote"] if existing_vote.data else None

        # ─── Logic credit ────────────────────────────────────────────
        if old_vote == "no_bid" and vote != "no_bid":
            # เปลี่ยนจาก no_bid -> อื่น: หัก credit กลับ
            await credit_service.use_credit(user_id, item_type, personal_limit)

        if old_vote != "no_bid" and vote == "no_bid":
            # เปลี่ยนจากอื่น -> no_bid: เพิ่ม credit
            await credit_service.add_credit(user_id, item_type, personal_limit)
        # ────────────────────────────────────────────────────────────

        if existing_vote.data:
            # อัปเดตโหวตเก่า (credit logic ทำข้างบนแล้ว)
            supabase.table("round_votes").update(
                {"vote": vote, "voted_at": "now()"}
            ).eq("id", existing_vote.data[0]["id"]).execute()
        else:
            # สร้างโหวตใหม่ — credit สำหรับ no_bid จัดการในบล็อกด้านบนแล้ว
            # (old_vote == None != "no_bid" and vote == "no_bid" → add_credit ทำงาน)
            supabase.table("round_votes").insert(
                {
                    "round_id": round_id,
                    "user_id": user_id,
                    "vote": vote,
                    "voted_at": "now()",
                }
            ).execute()

        return True, "บันทึกการโหวตเรียบร้อย"
    except Exception as e:
        print(f"[auction_service] save_vote error: {e}")
        return False, f"เกิดข้อผิดพลาด: {e}"


# ─── Queue ──────────────────────────────────────────────────────────────────

async def join_queue(round_id: str, discord_id: str, item_type: str) -> tuple[bool, str]:
    """เข้าคิวประมูล"""
    try:
        profile = await get_profile_by_discord_id(discord_id)
        if not profile:
            return False, "ไม่พบข้อมูลผู้ใช้ กรุณา /register ก่อน"

        user_id = profile["id"]

        # ตรวจสอบสถานะรอบ
        round_result = (
            supabase.table("auction_rounds")
            .select("status, item_type")
            .eq("id", round_id)
            .execute()
        )
        if not round_result.data:
            return False, "ไม่พบรอบประมูล"

        round_data = round_result.data[0]
        if round_data["status"] != "bidding":
            return False, "รอบนี้ยังไม่เปิดรับการจองคิว"

        # ตรวจสอบว่าโหวต want_bid ไหม
        vote_check = (
            supabase.table("round_votes")
            .select("vote")
            .eq("round_id", round_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not vote_check.data or vote_check.data[0]["vote"] != "want_bid":
            return False, "คุณต้องโหวต '✅ เข้าร่วม + ต้องการประมูล' ก่อนจึงจะจองคิวได้"

        # ตรวจว่าอยู่ในคิวแล้วหรือยัง
        existing_queue = (
            supabase.table("auction_queues")
            .select("id, status")
            .eq("round_id", round_id)
            .eq("user_id", user_id)
            .execute()
        )
        if existing_queue.data:
            status = existing_queue.data[0]["status"]
            if status == "waiting":
                return False, "คุณอยู่ในคิวแล้ว"
            elif status == "awarded":
                return False, "คุณได้รับไอเทมไปแล้วในรอบนี้"

        # เพิ่มเข้าคิว
        supabase.table("auction_queues").insert(
            {
                "round_id": round_id,
                "user_id": user_id,
                "item_type": item_type,
                "status": "waiting",
                "queued_at": "now()",
            }
        ).execute()

        return True, "เข้าคิวเรียบร้อย 🎉"
    except Exception as e:
        print(f"[auction_service] join_queue error: {e}")
        return False, f"เกิดข้อผิดพลาด: {e}"


# ─── Award ──────────────────────────────────────────────────────────────────

async def award_item(
    round_id: str,
    discord_id: str,
    item_type: str,
    awarded_by_discord_id: str,
    note: str | None = None,
) -> tuple[bool, str]:
    """มอบไอเทมให้ผู้ใช้"""
    try:
        profile = await get_profile_by_discord_id(discord_id)
        if not profile:
            return False, "ไม่พบข้อมูลผู้ใช้"

        awarded_by = await get_profile_by_discord_id(awarded_by_discord_id)
        if not awarded_by:
            return False, "ไม่พบข้อมูลผู้ award"

        user_id = profile["id"]
        awarded_by_id = awarded_by["id"]

        # ดึงรอบ
        round_result = (
            supabase.table("auction_rounds")
            .select("personal_limit, status")
            .eq("id", round_id)
            .execute()
        )
        if not round_result.data:
            return False, "ไม่พบรอบประมูล"

        round_data = round_result.data[0]
        personal_limit = round_data["personal_limit"]

        # ตรวจสอบคิว
        queue_result = (
            supabase.table("auction_queues")
            .select("id, status")
            .eq("round_id", round_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not queue_result.data:
            return False, "ผู้ใช้ไม่อยู่ในคิว"

        queue = queue_result.data[0]
        if queue["status"] != "waiting":
            return False, f"สถานะคิวของผู้ใช้คือ '{queue['status']}' ไม่สามารถ award ได้"

        # ตรวจสอบว่าได้รับไปแล้วกี่ชิ้น (จาก auction_history ในรอบนี้)
        history_check = (
            supabase.table("auction_history")
            .select("qty_awarded")
            .eq("round_id", round_id)
            .eq("user_id", user_id)
            .execute()
        )
        total_awarded = sum(row["qty_awarded"] for row in (history_check.data or []))
        if total_awarded >= personal_limit:
            return False, f"ผู้ใช้ได้รับครบลิมิต ({personal_limit}) แล้ว"

        # อัปเดตคิว -> awarded
        supabase.table("auction_queues").update(
            {
                "status": "awarded",
                "awarded_at": "now()",
                "awarded_by": awarded_by_id,
                "note": note,
            }
        ).eq("id", queue["id"]).execute()

        # บันทึก history
        supabase.table("auction_history").insert(
            {
                "round_id": round_id,
                "user_id": user_id,
                "item_type": item_type,
                "qty_awarded": 1,
                "awarded_by": awarded_by_id,
                "note": note,
                "awarded_at": "now()",
            }
        ).execute()

        # ใช้ credit ถ้ามี
        credit = await credit_service.get_credit_for_item(user_id, item_type)
        if credit > 0:
            await credit_service.use_credit(user_id, item_type, 1)

        # ตรวจสอบว่า award ครบทุกคนในคิวหรือยัง -> ปิดรอบ
        all_queues = (
            supabase.table("auction_queues")
            .select("status")
            .eq("round_id", round_id)
            .execute()
        )
        all_done = all(q["status"] != "waiting" for q in (all_queues.data or []))
        if all_done and all_queues.data:
            supabase.table("auction_rounds").update(
                {"status": "closed"}
            ).eq("id", round_id).execute()

        return True, "Award เรียบร้อย ✅"
    except Exception as e:
        print(f"[auction_service] award_item error: {e}")
        return False, f"เกิดข้อผิดพลาด: {e}"


# ─── Summary ─────────────────────────────────────────────────────────────────

async def get_round_summary(round_id: str) -> dict:
    """
    ดึงสรุปรอบ: จำนวนโหวตแต่ละประเภท + รายชื่อคิว
    """
    try:
        # ดึงข้อมูลโหวต
        votes_result = (
            supabase.table("round_votes")
            .select("vote, user_id, profiles(display_name)")
            .eq("round_id", round_id)
            .execute()
        )

        vote_counts = {"want_bid": 0, "no_bid": 0, "absent": 0}
        for v in votes_result.data or []:
            vote_counts[v["vote"]] = vote_counts.get(v["vote"], 0) + 1

        # ดึงคิว พร้อมชื่อและ credit
        queues_result = (
            supabase.table("auction_queues")
            .select("*, profiles(display_name, discord_id)")
            .eq("round_id", round_id)
            .order("queued_at")
            .execute()
        )

        # เพิ่ม credit ให้แต่ละ queue entry
        round_res = (
            supabase.table("auction_rounds")
            .select("item_type")
            .eq("id", round_id)
            .execute()
        )
        item_type = round_res.data[0]["item_type"] if round_res.data else ""

        queues = []
        for q in queues_result.data or []:
            uid = q["user_id"]
            credit = await credit_service.get_credit_for_item(uid, item_type)
            queues.append({**q, "credit": credit})

        # เรียงตาม credit DESC แล้ว queued_at ASC
        queues.sort(key=lambda x: (-x["credit"], x["queued_at"]))

        return {
            "vote_counts": vote_counts,
            "queues": queues,
        }
    except Exception as e:
        print(f"[auction_service] get_round_summary error: {e}")
        return {"vote_counts": {"want_bid": 0, "no_bid": 0, "absent": 0}, "queues": []}

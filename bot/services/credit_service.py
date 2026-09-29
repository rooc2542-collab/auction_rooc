from services.supabase_client import supabase


async def add_credit(user_id: str, item_type: str, amount: int) -> bool:
    """เพิ่ม carry credit ให้ผู้ใช้ (upsert)"""
    try:
        # ดึงค่า credit ปัจจุบัน
        existing = (
            supabase.table("carry_credits")
            .select("id, credit")
            .eq("user_id", user_id)
            .eq("item_type", item_type)
            .execute()
        )

        if existing.data:
            row = existing.data[0]
            new_credit = row["credit"] + amount
            supabase.table("carry_credits").update(
                {"credit": new_credit, "last_updated": "now()"}
            ).eq("id", row["id"]).execute()
        else:
            supabase.table("carry_credits").insert(
                {
                    "user_id": user_id,
                    "item_type": item_type,
                    "credit": amount,
                    "last_updated": "now()",
                }
            ).execute()

        return True
    except Exception as e:
        print(f"[credit_service] add_credit error: {e}")
        return False


async def use_credit(user_id: str, item_type: str, amount: int) -> bool:
    """หัก carry credit (ไม่ต่ำกว่า 0)"""
    try:
        existing = (
            supabase.table("carry_credits")
            .select("id, credit")
            .eq("user_id", user_id)
            .eq("item_type", item_type)
            .execute()
        )

        if existing.data:
            row = existing.data[0]
            new_credit = max(0, row["credit"] - amount)
            supabase.table("carry_credits").update(
                {"credit": new_credit, "last_updated": "now()"}
            ).eq("id", row["id"]).execute()
        # ถ้าไม่มี row ก็ไม่ต้องทำอะไร (credit = 0 อยู่แล้ว)
        return True
    except Exception as e:
        print(f"[credit_service] use_credit error: {e}")
        return False


async def get_credits(user_id: str) -> list:
    """ดึง credit ทุก item_type ของผู้ใช้"""
    try:
        result = (
            supabase.table("carry_credits")
            .select("item_type, credit")
            .eq("user_id", user_id)
            .execute()
        )
        return result.data or []
    except Exception as e:
        print(f"[credit_service] get_credits error: {e}")
        return []


async def get_credit_for_item(user_id: str, item_type: str) -> int:
    """ดึง credit เฉพาะ item_type"""
    try:
        result = (
            supabase.table("carry_credits")
            .select("credit")
            .eq("user_id", user_id)
            .eq("item_type", item_type)
            .execute()
        )
        if result.data:
            return result.data[0]["credit"]
        return 0
    except Exception as e:
        print(f"[credit_service] get_credit_for_item error: {e}")
        return 0

from __future__ import annotations
from services.supabase_client import supabase

ITEM_LABELS = {
    'Album': 'สมุดการ์ด',
    'Puppet': 'เศษการ์ดบอส',
    'White': 'ขนนกขาว',
    'RedBlack': 'ขนนกดำแดง',
}


def compute_total_from_coords(start_page: int, start_slot: int, end_page: int, end_slot: int) -> int:
    """คำนวณจำนวนชิ้นรวมจากพิกัดหน้า/ช่อง"""
    if end_page < start_page or (end_page == start_page and end_slot < start_slot):
        return 0
    return ((end_page - start_page) * 4) + (end_slot - start_slot) + 1


def allocate_slots(
    item_type: str,
    total_qty: int,
    personal_limit: int,
    start_page: int,
    start_slot: int,
    members: list[dict],
    credit_map: dict[str, int],
) -> list[dict]:
    """
    แจกจ่ายสล็อตให้สมาชิก (รองรับระบบทบยอดสะสม Carry Credit):
    1. เรียงลำดับตาม Carry Credit มากก่อน (ถ้าเท่ากันเรียงตามเวลาลงชื่อก่อน)
    2. ขั้นที่ 1 (Carry Credit Bonus): สมาชิกที่มียอดสะสมจากการกด 'ไม่ประมูล' (no_bid) ในรอบก่อน
       จะได้รับสล็อตทบตามยอดสะสมก่อน (ทำให้ได้รับจำนวนชิ้นมากกว่าคนอื่นในรอบนี้)
    3. ขั้นที่ 2 (Current Round Quota): นำจำนวนของที่เหลือมาแจกเฉลี่ยให้ทุกคนในรอบปัจจุบัน
       (ไม่เกิน personal_limit ของรอบปัจจุบันต่อคน) และหากมีเศษให้เรียงตามลำดับคิว
    4. แปลงเป็นพิกัด Page/Slot ในเกม (4 ช่องต่อหน้า) พร้อมบันทึก credit_used ของแต่ละคน
    """
    if not members or total_qty <= 0:
        return []

    sorted_members = sorted(
        members,
        key=lambda m: (-credit_map.get(m['user_id'], 0), members.index(m)),
    )
    n = len(sorted_members)

    alloc = {m['user_id']: 0 for m in sorted_members}
    credit_used = {m['user_id']: 0 for m in sorted_members}
    remaining = total_qty

    # ขั้นที่ 1: แจกสิทธิ์ทบจากยอดสะสม (Carry Credit) ให้คนที่มีแต้มสะสมก่อน
    max_credit = max((max(0, credit_map.get(m['user_id'], 0)) for m in sorted_members), default=0)
    for _ in range(max_credit):
        if remaining <= 0:
            break
        for m in sorted_members:
            if remaining <= 0:
                break
            uid = m['user_id']
            user_cred = max(0, credit_map.get(uid, 0))
            if credit_used[uid] < user_cred:
                alloc[uid] += 1
                credit_used[uid] += 1
                remaining -= 1

    # ขั้นที่ 2: นำของที่เหลือมาแบ่งโควตาของรอบปัจจุบันให้ทุกคน (คนละไม่เกิน personal_limit)
    if remaining > 0:
        base = min(remaining // n, personal_limit)
        for m in sorted_members:
            uid = m['user_id']
            alloc[uid] += base
        remaining -= base * n

        # กระจายเศษของรอบปัจจุบันให้คนที่ยังได้โควตารอบนี้ไม่ถึง personal_limit
        for m in sorted_members:
            if remaining <= 0:
                break
            uid = m['user_id']
            current_round_share = alloc[uid] - credit_used[uid]
            if current_round_share < personal_limit:
                alloc[uid] += 1
                remaining -= 1

    # ขั้นที่ 3: แปลงเป็น Page/Slot (หน้าละ 4 ช่อง)
    result = []
    cur_page = start_page
    cur_slot = start_slot

    for m in sorted_members:
        uid = m['user_id']
        qty = alloc[uid]
        used_cred = credit_used[uid]
        for idx in range(qty):
            result.append({
                'user_id': uid,
                'display_name': m.get('display_name', ''),
                'discord_id': m.get('discord_id', ''),
                'item_type': item_type,
                'page': cur_page,
                'slot': cur_slot,
                'from_credit': idx < used_cred,
                'credit_used_total': used_cred,
            })
            cur_slot += 1
            if cur_slot > 4:
                cur_slot = 1
                cur_page += 1

    last_page = cur_page if cur_slot > 1 else cur_page - 1
    for row in result:
        row['total_pages'] = max(last_page, start_page)

    return result


async def save_allocation(event_name: str, session_date: str, item_type: str, slots: list[dict]) -> None:
    """บันทึกผลการจัดสรรสล็อตลง DB"""
    supabase.table('allocated_slots').delete() \
        .eq('event_name', event_name) \
        .eq('session_date', session_date) \
        .eq('item_type', item_type) \
        .execute()

    if not slots:
        return

    rows = [{
        'event_name': event_name,
        'session_date': session_date,
        'user_id': s['user_id'],
        'item_type': s['item_type'],
        'page_number': s['page'],
        'slot_number': s['slot'],
        'total_pages': s['total_pages'],
        'status': 'allocated',
    } for s in slots]

    supabase.table('allocated_slots').insert(rows).execute()


async def get_event_session(event_name: str, session_date: str, item_type: str) -> dict | None:
    res = supabase.table('event_sessions') \
        .select('*') \
        .eq('event_name', event_name) \
        .eq('session_date', session_date) \
        .eq('item_type', item_type) \
        .limit(1) \
        .execute()
    return res.data[0] if res.data else None


async def get_event_attendees(event_name: str, session_date: str, item_type: str) -> list[dict]:
    """ดึงรายชื่อสมาชิกที่ต้องการไอเทมนี้ พร้อมข้อมูล profile"""
    res = supabase.table('event_attendance') \
        .select('discord_id, user_id, interested_items, created_at, profiles:user_id(display_name, discord_id)') \
        .eq('event_name', event_name) \
        .eq('event_date', session_date) \
        .eq('status', 'want_bid') \
        .execute()

    members = []
    for row in (res.data or []):
        items = row.get('interested_items') or []
        if item_type in items:
            profile = row.get('profiles') or {}
            members.append({
                'user_id': row['user_id'],
                'display_name': profile.get('display_name', 'Unknown'),
                'discord_id': row['discord_id'],
                'created_at': row['created_at'],
            })
    return members


async def get_credit_map(user_ids: list[str], item_type: str) -> dict[str, int]:
    """ดึง carry credits ของสมาชิกทุกคนสำหรับไอเทมนี้"""
    if not user_ids:
        return {}
    res = supabase.table('carry_credits') \
        .select('user_id, credit') \
        .in_('user_id', user_ids) \
        .eq('item_type', item_type) \
        .execute()
    return {r['user_id']: r['credit'] for r in (res.data or [])}

from __future__ import annotations
import os
import re
import asyncio
from datetime import date
import discord
from discord import app_commands
from discord.ext import commands, tasks
from services import auction_service
from services import allocation_service
from services.supabase_client import supabase
from views.attendance_view import (
    EventPollView,
    build_attendance_embed,
    ITEM_LABELS,
    close_poll_in_db_sync,
    open_poll_in_db_sync,
    is_poll_closed_sync,
)

ITEM_ORDER = ['Album', 'Puppet', 'White', 'RedBlack']

ITEM_CHOICES = [
    app_commands.Choice(name='Album (สมุดการ์ด)', value='Album'),
    app_commands.Choice(name='Puppet (เศษการ์ดบอส)', value='Puppet'),
    app_commands.Choice(name='White (ขนนกขาว)', value='White'),
    app_commands.Choice(name='RedBlack (ขนนกดำแดง)', value='RedBlack'),
]

# In-memory cache เพื่อให้ /set_items เปิด Modal ได้ทันทีใน 0ms โดยไม่ต้องรอ DB
_EVENTS_CACHE: list[tuple[str, str]] = []
_SESSIONS_CACHE: dict[tuple[str, str], dict[str, dict]] = {}
_POLL_MESSAGES_CACHE: dict[tuple[str, str], tuple[int, int]] = {}


async def find_poll_message(
    bot: commands.Bot,
    event_name: str,
    event_date: str,
) -> tuple[discord.TextChannel | None, discord.Message | None]:
    """ค้นหาข้อความโพลใน Discord จาก Cache, Database หรือค้นหาจากประวัติช่องแชท"""
    global _POLL_MESSAGES_CACHE

    # 1. ตรวจสอบใน In-memory Cache
    if (event_name, event_date) in _POLL_MESSAGES_CACHE:
        chan_id, msg_id = _POLL_MESSAGES_CACHE[(event_name, event_date)]
        try:
            ch = bot.get_channel(chan_id) or await bot.fetch_channel(chan_id)
            if isinstance(ch, discord.TextChannel):
                msg = await ch.fetch_message(msg_id)
                return ch, msg
        except Exception:
            pass

    # 2. ตรวจสอบในตาราง event_attendance ใน Supabase
    try:
        res = await asyncio.to_thread(
            lambda: supabase.table("event_attendance")
            .select("channel_id, message_id")
            .eq("event_name", event_name)
            .eq("event_date", event_date)
            .not_.is_("message_id", "null")
            .limit(1)
            .execute()
        )
        if res.data and res.data[0].get("message_id"):
            row = res.data[0]
            msg_id = int(row["message_id"])
            chan_id = int(row["channel_id"]) if row.get("channel_id") else None

            if chan_id:
                try:
                    ch = bot.get_channel(chan_id) or await bot.fetch_channel(chan_id)
                    if isinstance(ch, discord.TextChannel):
                        msg = await ch.fetch_message(msg_id)
                        _POLL_MESSAGES_CACHE[(event_name, event_date)] = (chan_id, msg_id)
                        return ch, msg
                except Exception:
                    pass

            for guild in bot.guilds:
                for ch in guild.text_channels:
                    try:
                        msg = await ch.fetch_message(msg_id)
                        _POLL_MESSAGES_CACHE[(event_name, event_date)] = (ch.id, msg_id)
                        return ch, msg
                    except Exception:
                        continue
    except Exception as e:
        print(f"[find_poll_message] DB lookup warning: {e}")

    # 3. Fallback: สแกนข้อความล่าสุดของบอทในช่องแชททั้งหมด
    try:
        for guild in bot.guilds:
            for ch in guild.text_channels:
                if not ch.permissions_for(guild.me).read_message_history:
                    continue
                try:
                    async for m in ch.history(limit=35):
                        if bot.user and m.author.id == bot.user.id and m.embeds:
                            emb = m.embeds[0]
                            title = (emb.title or "").removeprefix("⚔️ ").strip()
                            desc = (emb.description or "").removeprefix("📅 ").removeprefix("วันที่: ").strip()
                            if title == event_name and desc == event_date:
                                _POLL_MESSAGES_CACHE[(event_name, event_date)] = (ch.id, m.id)
                                return ch, m
                except Exception:
                    continue
    except Exception as e:
        print(f"[find_poll_message] Channel scan fallback error: {e}")

    return None, None


async def update_poll_message_status(
    bot: commands.Bot,
    event_name: str,
    event_date: str,
    is_closed: bool,
    closed_by: str | None = None,
) -> bool:
    """แก้ไขข้อความโพลใน Discord: เปิดหรือปิดปุ่ม พร้อมอัปเดต Embed Footer"""
    try:
        channel, message = await find_poll_message(bot, event_name, event_date)
        if not message:
            print(f"[PollSync] Could not find message for {event_name} ({event_date})")
            return False

        res = await asyncio.to_thread(
            lambda: supabase.table("event_attendance")
            .select("status")
            .eq("event_name", event_name)
            .eq("event_date", event_date)
            .execute()
        )
        counts = {"want_bid": 0, "no_bid": 0, "absent": 0}
        for row in (res.data or []):
            s = row.get("status", "")
            if s in counts:
                counts[s] += 1

        embed = build_attendance_embed(
            event_name,
            event_date,
            counts,
            is_closed=is_closed,
            closed_by=closed_by if is_closed else None,
        )
        view = EventPollView(event_name, event_date, disabled=is_closed)
        await message.edit(embed=embed, view=view)
        print(f"[PollSync] Successfully updated Discord poll message for {event_name} ({event_date}) -> is_closed={is_closed}")
        return True
    except Exception as e:
        print(f"[PollSync] Failed to update Discord poll message: {e}")
        return False



async def check_admin_defer(interaction: discord.Interaction) -> bool:
    """ตรวจสอบสิทธิ์ Admin หลัง defer แล้ว"""
    profile = await auction_service.get_profile_by_discord_id(str(interaction.user.id))
    if not profile or profile.get('role') != 'admin':
        if interaction.response.is_done():
            await interaction.followup.send('คำสั่งนี้ใช้ได้เฉพาะ Admin เท่านั้น', ephemeral=True)
        else:
            await interaction.response.send_message('คำสั่งนี้ใช้ได้เฉพาะ Admin เท่านั้น', ephemeral=True)
        return False
    return True


def get_db_events(limit: int = 25) -> list[tuple[str, str]]:
    """ดึงรายชื่อ (event_name, event_date) ทั้งหมดจากฐานข้อมูล เรียงจากล่าสุด (sync)"""
    global _EVENTS_CACHE, _SESSIONS_CACHE
    seen: set[tuple[str, str]] = set()
    result: list[tuple[str, str]] = []
    sessions_map: dict[tuple[str, str], dict[str, dict]] = {}
    try:
        s_res = supabase.table('event_sessions') \
            .select('*') \
            .order('created_at', desc=True) \
            .limit(100) \
            .execute()
        for r in (s_res.data or []):
            key = (r['event_name'], r['session_date'])
            sessions_map.setdefault(key, {})[r['item_type']] = r
            if key not in seen:
                seen.add(key)
                result.append(key)

        a_res = supabase.table('event_attendance') \
            .select('event_name, event_date, created_at') \
            .order('created_at', desc=True) \
            .limit(100) \
            .execute()
        for r in (a_res.data or []):
            key = (r['event_name'], r['event_date'])
            if key not in seen:
                seen.add(key)
                result.append(key)

        _EVENTS_CACHE = result[:limit]
        _SESSIONS_CACHE = sessions_map
    except Exception as e:
        print(f'[AuctionCog] get_db_events error: {e}')
    return result[:limit]


async def get_db_events_async(limit: int = 25) -> list[tuple[str, str]]:
    """Async wrapper — รัน get_db_events ใน thread pool ไม่ block event loop"""
    return await asyncio.to_thread(get_db_events, limit)


def parse_event_string(raw_str: str) -> tuple[str, str] | None:
    """แกะชื่ออีเวนต์และวันที่จาก 'ชื่อ|YYYY-MM-DD' หรือ 'ชื่อ (YYYY-MM-DD)'"""
    raw = raw_str.strip()
    if not raw:
        return None
    if '|' in raw:
        parts = raw.split('|', 1)
        return parts[0].strip(), parts[1].strip()
    paren_match = re.match(r'^(.+?)\s*\((\d{4}-\d{2}-\d{2})\)$', raw)
    if paren_match:
        return paren_match.group(1).strip(), paren_match.group(2).strip()
    return None


def resolve_event_key(event_key: str | None) -> tuple[str, str] | None:
    """แปลงค่าจาก Autocomplete ('ชื่อ|วันที่' หรือ 'ชื่อ (วันที่)' หรือ 'ชื่อ') หรือดึงรอบล่าสุดจาก DB"""
    if event_key:
        parsed = parse_event_string(event_key)
        if parsed:
            return parsed

    events = _EVENTS_CACHE if _EVENTS_CACHE else get_db_events(25)
    if not event_key or not event_key.strip():
        return events[0] if events else None

    raw = event_key.strip()
    for en, ed in events:
        if en == raw:
            return en, ed

    return raw, str(date.today())


async def event_autocomplete(
    interaction: discord.Interaction,
    current: str,
) -> list[app_commands.Choice[str]]:
    """Autocomplete ดึงชื่อรอบกิจกรรมจากฐานข้อมูลโดยตรง (ไม่ block event loop)"""
    try:
        events = await get_db_events_async(25)
    except Exception:
        events = _EVENTS_CACHE
    choices: list[app_commands.Choice[str]] = []
    q = current.lower().strip()
    for en, ed in events:
        display = f'{en} ({ed})'
        val = f'{en}|{ed}'
        if not q or q in display.lower():
            choices.append(app_commands.Choice(name=display[:100], value=val[:100]))
    return choices[:25]


def parse_qty_and_limit(raw_qty: str, raw_limit: str) -> tuple[str, int, int, int, int, int, int]:
    """
    แปลงช่องกรอกแยก 2 ช่อง (ช่องจำนวน/พิกัด และ ช่องลิมิตต่อคน) โดยไม่ต้องใช้ลูกน้ำ ,
    - raw_qty: ตัวเลขจำนวนชิ้น เช่น '12' หรือพิกัด '1:1-3:4' (ใส่ '0' ถ้าไม่มี)
    - raw_limit: ตัวเลขลิมิตต่อคน เช่น '2'
    คืนค่า: (mode, start_page, start_slot, end_page, end_slot, total_qty, limit)
    """
    q_text = (raw_qty or '').strip()
    l_text = (raw_limit or '').strip()

    # เผื่อผู้ใช้เผลอพิมพ์ลูกน้ำมาในช่องแรก ก็ยังรองรับได้ไม่พัง
    if ',' in q_text:
        parts = [p.strip() for p in q_text.split(',', 1)]
        q_text = parts[0]
        if not l_text and len(parts) > 1:
            l_text = parts[1]

    limit_val = max(1, int(l_text)) if l_text.isdigit() and int(l_text) > 0 else 1

    if not q_text or q_text == '0':
        return ('qty', 1, 1, 1, 1, 0, limit_val)

    coord_match = re.match(r'^(\d+)\s*:\s*([1-4])\s*-\s*(\d+)\s*:\s*([1-4])$', q_text)
    if coord_match:
        sp = int(coord_match.group(1))
        ss = int(coord_match.group(2))
        ep = int(coord_match.group(3))
        es = int(coord_match.group(4))
        total = allocation_service.compute_total_from_coords(sp, ss, ep, es)
        return ('coord', sp, ss, ep, es, max(0, total), limit_val)

    qty_val = max(0, int(q_text)) if q_text.isdigit() else 0
    return ('qty', 1, 1, 1, 1, qty_val, limit_val)


def parse_item_input(raw: str) -> tuple[str, int, int, int, int, int, int]:
    """ฟังก์ชันรองรับรูปแบบเดิม ('จำนวน, ลิมิต') สำหรับ backward compatibility"""
    text = (raw or '').strip()
    if ',' in text:
        parts = [p.strip() for p in text.split(',', 1)]
        return parse_qty_and_limit(parts[0], parts[1])
    return parse_qty_and_limit(text, '1')


def recalculate_continuous_sessions(
    event_name: str,
    session_date: str,
    items_config: dict[str, dict],
    current_status: str = 'active',
) -> list[dict]:
    """
    คำนวณพิกัดหน้าและช่อง (Page/Slot 1-4) ต่อเนื่องกันทั้ง 4 ไอเทมตามลำดับ ITEM_ORDER
    """
    running_page = 1
    running_slot = 1
    rows: list[dict] = []

    for item_key in ITEM_ORDER:
        cfg = items_config.get(item_key, {})
        mode = cfg.get('mode', 'qty')
        total_qty = int(cfg.get('total_quantity', 0) or 0)
        limit_val = max(1, int(cfg.get('personal_limit', 1) or 1))
        sp = int(cfg.get('start_page', 1) or 1)
        ss = int(cfg.get('start_slot', 1) or 1)
        ep = int(cfg.get('end_page', 1) or 1)
        es = int(cfg.get('end_slot', 1) or 1)

        if mode == 'coord' and total_qty > 0:
            next_slot = es + 1
            next_page = ep
            if next_slot > 4:
                next_slot = 1
                next_page += 1
            running_page, running_slot = next_page, next_slot
        else:
            if total_qty > 0:
                sp = running_page
                ss = running_slot
                offset = (ss - 1) + total_qty - 1
                ep = sp + (offset // 4)
                es = (offset % 4) + 1
                next_offset = offset + 1
                running_page = sp + (next_offset // 4)
                running_slot = (next_offset % 4) + 1
            else:
                sp, ss, ep, es = 1, 1, 1, 1

        rows.append({
            'event_name': event_name,
            'session_date': session_date,
            'item_type': item_key,
            'start_page': sp,
            'start_slot': ss,
            'end_page': ep,
            'end_slot': es,
            'total_quantity': total_qty,
            'personal_limit': limit_val,
            'status': current_status,
        })

    return rows


async def save_and_build_summary_embed(
    event_name: str,
    session_date: str,
    updated_subset: dict[str, tuple[str, int, int, int, int, int, int]],
    step_title: str,
) -> discord.Embed:
    """โหลดค่าปัจจุบันของทั้ง 4 ไอเทม ผสานกับค่าที่เพิ่งแก้ไข คำนวณพิกัดใหม่ และบันทึกลง DB"""
    res = await asyncio.to_thread(
        lambda: supabase.table('event_sessions')
        .select('*')
        .eq('event_name', event_name)
        .eq('session_date', session_date)
        .execute()
    )
    existing_rows = {r['item_type']: r for r in (res.data or [])}

    # รักษาสถานะเดิมของรอบ (เช่น ถ้าปิดโหวต 'closed' แล้ว ให้คงสถานะ 'closed' ไว้)
    current_status = 'active'
    if existing_rows and all(r.get('status') == 'closed' for r in existing_rows.values()):
        current_status = 'closed'

    merged_config: dict[str, dict] = {}
    for item_key in ITEM_ORDER:
        if item_key in updated_subset:
            mode, sp, ss, ep, es, total_qty, limit_val = updated_subset[item_key]
            merged_config[item_key] = {
                'mode': mode,
                'start_page': sp,
                'start_slot': ss,
                'end_page': ep,
                'end_slot': es,
                'total_quantity': total_qty,
                'personal_limit': limit_val,
            }
        elif item_key in existing_rows:
            r = existing_rows[item_key]
            merged_config[item_key] = {
                'mode': 'qty',
                'start_page': r.get('start_page', 1),
                'start_slot': r.get('start_slot', 1),
                'end_page': r.get('end_page', 1),
                'end_slot': r.get('end_slot', 1),
                'total_quantity': r.get('total_quantity', 0),
                'personal_limit': r.get('personal_limit', 1),
            }
        else:
            merged_config[item_key] = {
                'mode': 'qty',
                'start_page': 1,
                'start_slot': 1,
                'end_page': 1,
                'end_slot': 1,
                'total_quantity': 0,
                'personal_limit': 1,
            }

    final_rows = recalculate_continuous_sessions(
        event_name, session_date, merged_config, current_status=current_status
    )

    for row_data in final_rows:
        await asyncio.to_thread(
            lambda d=row_data: supabase.table('event_sessions')
            .upsert(d, on_conflict='event_name,session_date,item_type')
            .execute()
        )
        _SESSIONS_CACHE.setdefault((event_name, session_date), {})[row_data['item_type']] = row_data

    embed = discord.Embed(
        title=step_title,
        description=f'รอบกิจกรรม: **{event_name}** ({session_date})',
        color=discord.Color.green(),
    )
    for row_data in final_rows:
        item_key = row_data['item_type']
        iname = ITEM_LABELS.get(item_key, item_key)
        total_qty = row_data['total_quantity']
        limit_val = row_data['personal_limit']
        sp, ss, ep, es = row_data['start_page'], row_data['start_slot'], row_data['end_page'], row_data['end_slot']
        if total_qty > 0:
            embed.add_field(
                name=iname,
                value=f'จำนวน **{total_qty}** ชิ้น | ลิมิต **{limit_val}**/คน\n`Page {sp}:{ss} -> {ep}:{es}`',
                inline=True,
            )
        else:
            embed.add_field(
                name=iname,
                value='ไม่มีไอเทม (0 ชิ้น)',
                inline=True,
            )
    embed.set_footer(text='สามารถกดปุ่มด้านล่างเพื่อตั้งค่าไอเทมชุดถัดไป หรือแก้ไขซ้ำได้ทันที')
    return embed


class SetItemsPart1Modal(discord.ui.Modal):
    """
    หน้าต่างที่ 1: สมุดการ์ด และ เศษการ์ดบอส
    แยก 2 ช่องต่อไอเทม (ช่องจำนวน และ ช่องลิมิตต่อคน) รวม 4 ช่อง
    """

    album_qty = discord.ui.TextInput(
        label='สมุดการ์ด - จำนวนชิ้น (หรือพิกัด 1:1-3:4)',
        placeholder='กรอกเฉพาะตัวเลข เช่น 12 (ใส่ 0 ถ้าไม่มี)',
        required=True,
        max_length=30,
    )
    album_limit = discord.ui.TextInput(
        label='สมุดการ์ด - ลิมิตต่อคน',
        placeholder='กรอกเฉพาะตัวเลข เช่น 2',
        required=True,
        max_length=10,
    )
    puppet_qty = discord.ui.TextInput(
        label='เศษการ์ดบอส - จำนวนชิ้น (หรือพิกัด)',
        placeholder='กรอกเฉพาะตัวเลข เช่น 20 (ใส่ 0 ถ้าไม่มี)',
        required=True,
        max_length=30,
    )
    puppet_limit = discord.ui.TextInput(
        label='เศษการ์ดบอส - ลิมิตต่อคน',
        placeholder='กรอกเฉพาะตัวเลข เช่น 3',
        required=True,
        max_length=10,
    )

    def __init__(self, event_name: str, session_date: str, existing_map: dict[str, dict]):
        modal_title = f'ตั้งค่าไอเทม (1/2) - {event_name}'[:45]
        super().__init__(title=modal_title)
        self._event_name = event_name
        self._session_date = session_date

        album_row = existing_map.get('Album', {})
        puppet_row = existing_map.get('Puppet', {})

        self.album_qty.default = str(album_row.get('total_quantity', 0))
        self.album_limit.default = str(album_row.get('personal_limit', 1))
        self.puppet_qty.default = str(puppet_row.get('total_quantity', 0))
        self.puppet_limit.default = str(puppet_row.get('personal_limit', 1))

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        if not await check_admin_defer(interaction):
            return

        try:
            updated = {
                'Album': parse_qty_and_limit(str(self.album_qty), str(self.album_limit)),
                'Puppet': parse_qty_and_limit(str(self.puppet_qty), str(self.puppet_limit)),
            }
            embed = await save_and_build_summary_embed(
                self._event_name,
                self._session_date,
                updated,
                step_title='บันทึก สมุดการ์ด และ เศษการ์ดบอส สำเร็จ (1/2)',
            )
            view = SetItemsStepView(self._event_name, self._session_date)
            await interaction.followup.send(embed=embed, view=view, ephemeral=True)
        except Exception as e:
            await interaction.followup.send(f'เกิดข้อผิดพลาดในการบันทึก: {e}', ephemeral=True)


class SetItemsPart2Modal(discord.ui.Modal):
    """
    หน้าต่างที่ 2: ขนนกขาว และ ขนนกดำแดง
    แยก 2 ช่องต่อไอเทม (ช่องจำนวน และ ช่องลิมิตต่อคน) รวม 4 ช่อง
    """

    white_qty = discord.ui.TextInput(
        label='ขนนกขาว - จำนวนชิ้น (หรือพิกัด 1:1-3:4)',
        placeholder='กรอกเฉพาะตัวเลข เช่น 16 (ใส่ 0 ถ้าไม่มี)',
        required=True,
        max_length=30,
    )
    white_limit = discord.ui.TextInput(
        label='ขนนกขาว - ลิมิตต่อคน',
        placeholder='กรอกเฉพาะตัวเลข เช่น 2',
        required=True,
        max_length=10,
    )
    redblack_qty = discord.ui.TextInput(
        label='ขนนกดำแดง - จำนวนชิ้น (หรือพิกัด)',
        placeholder='กรอกเฉพาะตัวเลข เช่น 8 (ใส่ 0 ถ้าไม่มี)',
        required=True,
        max_length=30,
    )
    redblack_limit = discord.ui.TextInput(
        label='ขนนกดำแดง - ลิมิตต่อคน',
        placeholder='กรอกเฉพาะตัวเลข เช่น 1',
        required=True,
        max_length=10,
    )

    def __init__(self, event_name: str, session_date: str, existing_map: dict[str, dict]):
        modal_title = f'ตั้งค่าไอเทม (2/2) - {event_name}'[:45]
        super().__init__(title=modal_title)
        self._event_name = event_name
        self._session_date = session_date

        white_row = existing_map.get('White', {})
        redblack_row = existing_map.get('RedBlack', {})

        self.white_qty.default = str(white_row.get('total_quantity', 0))
        self.white_limit.default = str(white_row.get('personal_limit', 1))
        self.redblack_qty.default = str(redblack_row.get('total_quantity', 0))
        self.redblack_limit.default = str(redblack_row.get('personal_limit', 1))

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        if not await check_admin_defer(interaction):
            return

        try:
            updated = {
                'White': parse_qty_and_limit(str(self.white_qty), str(self.white_limit)),
                'RedBlack': parse_qty_and_limit(str(self.redblack_qty), str(self.redblack_limit)),
            }
            embed = await save_and_build_summary_embed(
                self._event_name,
                self._session_date,
                updated,
                step_title='บันทึกไอเทมครบทั้ง 4 ประเภทเรียบร้อยแล้ว (2/2)',
            )
            view = SetItemsStepView(self._event_name, self._session_date)
            await interaction.followup.send(embed=embed, view=view, ephemeral=True)
        except Exception as e:
            await interaction.followup.send(f'เกิดข้อผิดพลาดในการบันทึก: {e}', ephemeral=True)


class SetItemsStepView(discord.ui.View):
    """ปุ่มกดสำหรับสลับเปิดหน้าต่างที่ 1 และหน้าต่างที่ 2 โดยไม่ต้องพิมพ์คำสั่งใหม่"""

    def __init__(self, event_name: str, session_date: str):
        super().__init__(timeout=600)
        self._event_name = event_name
        self._session_date = session_date

    @discord.ui.button(label='ตั้งค่า ขนนกขาว & ขนนกดำแดง (2/2)', style=discord.ButtonStyle.primary)
    async def open_part2(self, interaction: discord.Interaction, button: discord.ui.Button):
        existing_map = _SESSIONS_CACHE.get((self._event_name, self._session_date), {})
        modal = SetItemsPart2Modal(self._event_name, self._session_date, existing_map)
        await interaction.response.send_modal(modal)

    @discord.ui.button(label='แก้ไข สมุดการ์ด & เศษการ์ดบอส (1/2)', style=discord.ButtonStyle.secondary)
    async def open_part1(self, interaction: discord.Interaction, button: discord.ui.Button):
        existing_map = _SESSIONS_CACHE.get((self._event_name, self._session_date), {})
        modal = SetItemsPart1Modal(self._event_name, self._session_date, existing_map)
        await interaction.response.send_modal(modal)


class AuctionCog(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        self._last_poll_status: dict[tuple[str, str], str] = {}
        try:
            self.poll_status_sync_loop.start()
        except Exception:
            pass

    def cog_unload(self) -> None:
        try:
            self.poll_status_sync_loop.cancel()
        except Exception:
            pass

    @tasks.loop(minutes=10)
    async def poll_status_sync_loop(self) -> None:
        """ตรวจจับการเปลี่ยนแปลงสถานะเปิด/ปิดโหวตจาก Web App ทุก 10 นาที และอัปเดตข้อความใน Discord อัตโนมัติ"""
        if not self.bot.is_ready():
            return
        try:
            res = await asyncio.to_thread(
                lambda: supabase.table("event_sessions")
                .select("event_name, session_date, status")
                .order("created_at", desc=True)
                .limit(20)
                .execute()
            )
            rows = res.data or []
            if not rows:
                return

            grouped: dict[tuple[str, str], list[str]] = {}
            for r in rows:
                en = r.get("event_name", "")
                ed = r.get("session_date", "")
                if en and ed:
                    grouped.setdefault((en, ed), []).append(r.get("status", "active"))

            for (en, ed), statuses in grouped.items():
                is_closed_in_db = all(s == "closed" for s in statuses)
                current_state = "closed" if is_closed_in_db else "active"

                last_state = self._last_poll_status.get((en, ed))
                if last_state is None:
                    self._last_poll_status[(en, ed)] = current_state
                    # หากใน DB เปิดอยู่ ให้ตรวจสอบและปลดล็อกปุ่มโพล
                    if not is_closed_in_db:
                        try:
                            ch, msg = await find_poll_message(self.bot, en, ed)
                            if msg and msg.components:
                                first_row = msg.components[0]
                                if first_row.children and getattr(first_row.children[0], "disabled", False):
                                    print(f"[PollSync] Re-enabling buttons on startup for active poll {en} ({ed})")
                                    await update_poll_message_status(self.bot, en, ed, is_closed=False)
                        except Exception as err:
                            print(f"[PollSync] Startup check error: {err}")
                    continue

                if last_state != current_state:
                    print(f"[PollSync] Detected status change for {en} ({ed}): {last_state} -> {current_state}")
                    self._last_poll_status[(en, ed)] = current_state

                    if is_closed_in_db:
                        await update_poll_message_status(self.bot, en, ed, is_closed=True, closed_by="Web Admin")
                    else:
                        await update_poll_message_status(self.bot, en, ed, is_closed=False)
        except Exception as e:
            pass

    # ─── /event_poll ─────────────────────────────────────────────────────
    @app_commands.command(name='event_poll', description='[Admin] เปิดโพลนับคนเข้าร่วมกิจกรรม/วอร์ และสร้างรอบในระบบทันที')
    @app_commands.describe(
        event_name='ชื่อรอบกิจกรรม เช่น กิลวอ หรือ กิลลีค',
        channel='ช่องที่จะส่งโพล',
        event_date='วันที่ (YYYY-MM-DD) ค่าเริ่มต้นคือวันนี้',
    )
    async def event_poll(
        self,
        interaction: discord.Interaction,
        event_name: str,
        channel: discord.TextChannel,
        event_date: str | None = None,
    ) -> None:
        await interaction.response.defer(ephemeral=True)
        if not await check_admin_defer(interaction):
            return

        today = (event_date or str(date.today())).strip()
        clean_name = event_name.strip()

        for item_key in ITEM_ORDER:
            row_data = {
                'event_name': clean_name,
                'session_date': today,
                'item_type': item_key,
                'start_page': 1,
                'start_slot': 1,
                'end_page': 1,
                'end_slot': 1,
                'total_quantity': 0,
                'personal_limit': 1,
                'status': 'active',
            }
            await asyncio.to_thread(
                lambda d=row_data: supabase.table('event_sessions')
                .upsert(d, on_conflict='event_name,session_date,item_type')
                .execute()
            )
            _SESSIONS_CACHE.setdefault((clean_name, today), {})[item_key] = row_data

        if (clean_name, today) not in _EVENTS_CACHE:
            _EVENTS_CACHE.insert(0, (clean_name, today))

        embed = build_attendance_embed(clean_name, today, is_closed=False)
        view = EventPollView(clean_name, today)
        sent_msg = await channel.send(embed=embed, view=view)

        _POLL_MESSAGES_CACHE[(clean_name, today)] = (channel.id, sent_msg.id)
        self._last_poll_status[(clean_name, today)] = 'active'

        await interaction.followup.send(
            f'เปิดโพลและบันทึกรอบลงระบบเรียบร้อยที่ {channel.mention}\n'
            f'รอบกิจกรรม: **{clean_name}** ({today})\n'
            f'ขั้นตอนถัดไป: ใช้คำสั่ง `/set_items` เพื่อกรอกจำนวนและลิมิตไอเทม',
            ephemeral=True
        )

    # ─── /close_poll (ปิดโหวตผ่านคำสั่ง) ──────────────────────────────────
    @app_commands.command(name='close_poll', description='[Admin] ปิดโหวตของรอบกิจกรรม เพื่อเตรียมประกาศผลจัดสรรสล็อต')
    @app_commands.describe(
        event='เลือกรอบกิจกรรมจากฐานข้อมูล (หากไม่เลือกจะใช้รอบล่าสุดอัตโนมัติ)',
    )
    @app_commands.autocomplete(event=event_autocomplete)
    async def close_poll(
        self,
        interaction: discord.Interaction,
        event: str | None = None,
    ) -> None:
        await interaction.response.defer(ephemeral=True)
        if not await check_admin_defer(interaction):
            return

        resolved = resolve_event_key(event)
        if not resolved:
            await interaction.followup.send('ยังไม่มีรอบกิจกรรมในระบบ', ephemeral=True)
            return

        event_name, event_date = resolved
        await asyncio.to_thread(close_poll_in_db_sync, event_name, event_date)

        if (event_name, event_date) in _SESSIONS_CACHE:
            for row in _SESSIONS_CACHE[(event_name, event_date)].values():
                row['status'] = 'closed'
        self._last_poll_status[(event_name, event_date)] = 'closed'

        await update_poll_message_status(self.bot, event_name, event_date, is_closed=True, closed_by=interaction.user.display_name)

        await interaction.followup.send(
            f'ปิดโหวตรอบกิจกรรม **{event_name}** ({event_date}) เรียบร้อยแล้ว ตอนนี้สามารถใช้คำสั่ง `/announce_allocation` เพื่อแจ้งผลให้สมาชิกได้เลยครับ',
            ephemeral=True
        )

    # ─── /reopen_poll (เปิดโหวตอีกครั้ง) ──────────────────────────────────
    @app_commands.command(name='reopen_poll', description='[Admin] เปิดรับโหวตอีกครั้ง ปลดล็อกปุ่มให้สมาชิกกดได้')
    @app_commands.describe(
        event='เลือกรอบกิจกรรมจากฐานข้อมูล (หากไม่เลือกจะใช้รอบล่าสุดอัตโนมัติ)',
    )
    @app_commands.autocomplete(event=event_autocomplete)
    async def reopen_poll(
        self,
        interaction: discord.Interaction,
        event: str | None = None,
    ) -> None:
        await interaction.response.defer(ephemeral=True)
        if not await check_admin_defer(interaction):
            return

        resolved = resolve_event_key(event)
        if not resolved:
            await interaction.followup.send('ยังไม่มีรอบกิจกรรมในระบบ', ephemeral=True)
            return

        event_name, event_date = resolved
        await asyncio.to_thread(open_poll_in_db_sync, event_name, event_date)

        if (event_name, event_date) in _SESSIONS_CACHE:
            for row in _SESSIONS_CACHE[(event_name, event_date)].values():
                row['status'] = 'active'
        self._last_poll_status[(event_name, event_date)] = 'active'

        ok = await update_poll_message_status(self.bot, event_name, event_date, is_closed=False)
        msg_extra = " และปลดล็อกปุ่มโพลในดิสคอร์ดเรียบร้อยแล้ว" if ok else ""
        await interaction.followup.send(
            f'เปิดรับโหวตรอบกิจกรรม **{event_name}** ({event_date}) อีกครั้งเรียบร้อยแล้ว{msg_extra} สมาชิกสามารถกดโหวตได้ตามปกติครับ',
            ephemeral=True
        )

    # ─── /set_items (แยก 2 ช่องต่อไอเทม: จำนวน และ ลิมิต) ──────────────────
    @app_commands.command(name='set_items', description='[Admin] ตั้งค่าจำนวนและลิมิตไอเทม (แยกช่องจำนวนและช่องลิมิต)')
    @app_commands.describe(
        event='เลือกรอบกิจกรรมจากฐานข้อมูล (หากไม่เลือกจะใช้รอบล่าสุดอัตโนมัติ)',
    )
    @app_commands.autocomplete(event=event_autocomplete)
    async def set_items(
        self,
        interaction: discord.Interaction,
        event: str | None = None,
    ) -> None:
        try:
            event_name: str | None = None
            session_date: str | None = None

            if event and event.strip():
                parsed = parse_event_string(event)
                if parsed:
                    event_name, session_date = parsed
                else:
                    raw = event.strip()
                    for en, ed in _EVENTS_CACHE:
                        if en == raw:
                            event_name, session_date = en, ed
                            break
                    if not event_name:
                        event_name, session_date = raw, str(date.today())
            else:
                if _EVENTS_CACHE:
                    event_name, session_date = _EVENTS_CACHE[0]
                else:
                    events = await get_db_events_async(5)
                    if events:
                        event_name, session_date = events[0]

            if not event_name or not session_date:
                await interaction.response.send_message(
                    'ยังไม่มีรอบกิจกรรมในระบบ กรุณาเปิดโพลด้วย `/event_poll` ก่อนครับ',
                    ephemeral=True
                )
                return

            existing_map = _SESSIONS_CACHE.get((event_name, session_date), {})
            modal = SetItemsPart1Modal(event_name, session_date, existing_map)
            await interaction.response.send_modal(modal)
        except Exception as e:
            print(f'[AuctionCog] /set_items error: {e}')
            if not interaction.response.is_done():
                await interaction.response.send_message(f'ไม่สามารถเปิดหน้าต่างตั้งค่าได้: {e}', ephemeral=True)

    # ─── /delete_event (ลบรอบกิจกรรมที่ผิดพลาด) ─────────────────────────────
    @app_commands.command(name='delete_event', description='[Admin] ลบรอบกิจกรรมและข้อมูลคิว/สล็อตของรอบนั้นเพื่อคีย์ใหม่')
    @app_commands.describe(
        event='เลือกรอบกิจกรรมที่ต้องการลบจากฐานข้อมูล',
    )
    @app_commands.autocomplete(event=event_autocomplete)
    async def delete_event(
        self,
        interaction: discord.Interaction,
        event: str,
    ) -> None:
        await interaction.response.defer(ephemeral=True)
        if not await check_admin_defer(interaction):
            return

        resolved = resolve_event_key(event)
        if not resolved:
            await interaction.followup.send('ไม่พบรอบกิจกรรมที่ต้องการลบ', ephemeral=True)
            return

        event_name, event_date = resolved
        try:
            await asyncio.to_thread(
                lambda: supabase.table('allocated_slots').delete().eq('event_name', event_name).eq('session_date', event_date).execute()
            )
            await asyncio.to_thread(
                lambda: supabase.table('event_attendance').delete().eq('event_name', event_name).eq('event_date', event_date).execute()
            )
            await asyncio.to_thread(
                lambda: supabase.table('event_sessions').delete().eq('event_name', event_name).eq('session_date', event_date).execute()
            )

            if (event_name, event_date) in _EVENTS_CACHE:
                _EVENTS_CACHE.remove((event_name, event_date))
            _SESSIONS_CACHE.pop((event_name, event_date), None)

            await interaction.followup.send(
                f'ลบรอบกิจกรรม **{event_name}** ({event_date}) ออกจากฐานข้อมูลเรียบร้อยแล้วครับ',
                ephemeral=True
            )
        except Exception as e:
            await interaction.followup.send(f'ลบไม่สำเร็จ: {e}', ephemeral=True)

    # ─── /announce_allocation ────────────────────────────────────────────
    @app_commands.command(name='announce_allocation', description='[Admin] คำนวณและประกาศผลการจัดสรรสล็อตลงห้องแชท (ต้องปิดโหวตก่อน)')
    @app_commands.describe(
        channel='ช่องที่จะประกาศผล',
        event='เลือกรอบกิจกรรมจากฐานข้อมูล (หากไม่เลือกจะใช้รอบล่าสุดอัตโนมัติ)',
    )
    @app_commands.autocomplete(event=event_autocomplete)
    async def announce_allocation(
        self,
        interaction: discord.Interaction,
        channel: discord.TextChannel,
        event: str | None = None,
    ) -> None:
        await interaction.response.defer(ephemeral=True)
        if not await check_admin_defer(interaction):
            return

        resolved = resolve_event_key(event)
        if not resolved:
            await interaction.followup.send('ยังไม่มีรอบกิจกรรมในระบบ', ephemeral=True)
            return

        event_name, today = resolved

        sessions_res = await asyncio.to_thread(
            lambda: supabase.table('event_sessions')
            .select('*')
            .eq('event_name', event_name)
            .eq('session_date', today)
            .execute()
        )
        all_sessions = sessions_res.data or []

        if not all_sessions:
            await interaction.followup.send(
                f'ไม่พบข้อมูลรอบกิจกรรม **{event_name}** ({today})',
                ephemeral=True
            )
            return

        # เงื่อนไขบังคับ: ต้องทำการปิดโหวตก่อน (status == 'closed') จึงจะประกาศผลให้สมาชิกรับรู้ได้
        is_closed = all(s.get('status') == 'closed' for s in all_sessions)
        if not is_closed:
            await interaction.followup.send(
                f'ไม่สามารถประกาศผลสำหรับ **{event_name}** ({today}) ได้ เนื่องจากยังไม่ได้ปิดโหวต\n'
                f'กรุณากดปุ่ม **"ปิดโหวต [Admin]"** ที่ข้อความโพล หรือใช้คำสั่ง `/close_poll` ก่อนครับ',
                ephemeral=True
            )
            return

        sessions = [s for s in all_sessions if (s.get('total_quantity') or 0) > 0]
        if not sessions:
            await interaction.followup.send(
                f'ยังไม่ได้กำหนดจำนวนไอเทมสำหรับ **{event_name}** ({today})\n'
                f'กรุณาใช้คำสั่ง `/set_items` เพื่อระบุจำนวนไอเทมก่อนครับ',
                ephemeral=True
            )
            return

        overall_total_pages = max((s.get('end_page', 1) for s in sessions), default=1)
        header_embed = discord.Embed(
            title=f'ผลการจัดสรรสล็อต — {event_name}',
            description=f'วันที่: {today} | ประกาศโดย {interaction.user.display_name}',
            color=discord.Color.gold()
        )

        combined_member_slots: dict[str, dict] = {}

        no_bid_res = await asyncio.to_thread(
            lambda: supabase.table('event_attendance')
            .select('user_id')
            .eq('event_name', event_name)
            .eq('event_date', today)
            .eq('status', 'no_bid')
            .execute()
        )
        no_bid_users = [r['user_id'] for r in (no_bid_res.data or []) if r.get('user_id')]

        from services import credit_service
        sessions_sorted = sorted(
            sessions,
            key=lambda x: ITEM_ORDER.index(x['item_type']) if x['item_type'] in ITEM_ORDER else 99
        )

        for session in sessions_sorted:
            item_type = session['item_type']
            total_qty = session['total_quantity']
            personal_limit = session['personal_limit']
            start_page = session['start_page']
            start_slot = session['start_slot']

            iname = ITEM_LABELS.get(item_type, item_type)

            members = await allocation_service.get_event_attendees(event_name, today, item_type)

            if not members:
                for uid in no_bid_users:
                    await credit_service.add_credit(uid, item_type, personal_limit)
                header_embed.add_field(
                    name=f'{iname}',
                    value=f'จำนวน {total_qty} ชิ้น | ไม่มีผู้เข้าร่วมขอไอเทมนี้',
                    inline=False
                )
                continue

            user_ids = [m['user_id'] for m in members]
            credit_map = await allocation_service.get_credit_map(user_ids, item_type)

            slots = allocation_service.allocate_slots(
                item_type, total_qty, personal_limit,
                start_page, start_slot, members, credit_map
            )
            for s in slots:
                s['total_pages'] = max(overall_total_pages, s.get('total_pages', 1))

            await allocation_service.save_allocation(event_name, today, item_type, slots)

            # หักยอดสะสม (Carry Credit) เฉพาะจำนวนที่ใช้ทบจริงในรอบนี้
            used_by_user: dict[str, int] = {}
            for s in slots:
                uid = s['user_id']
                used_amt = s.get('credit_used_total', 0)
                if used_amt > 0:
                    used_by_user[uid] = used_amt
            for uid, used_amt in used_by_user.items():
                await credit_service.use_credit(uid, item_type, used_amt)

            # เพิ่มยอดสะสม (Carry Credit) ให้สมาชิกที่เข้าร่วมวอร์แต่เลือกไม่ประมูลวันนี้ (no_bid)
            for uid in no_bid_users:
                await credit_service.add_credit(uid, item_type, personal_limit)

            for s in slots:
                did = s['discord_id']
                if did not in combined_member_slots:
                    combined_member_slots[did] = {'name': s['display_name'], 'uid': did, 'slots': []}
                combined_member_slots[did]['slots'].append((s['page'], s['slot']))

            header_embed.add_field(
                name=f'{iname}',
                value=f'จำนวน {total_qty} ชิ้น | {len(members)} คนขอ | ลิมิต {personal_limit}/คน',
                inline=True
            )

        await channel.send(embed=header_embed)

        member_blocks: list[str] = []
        for did, info in combined_member_slots.items():
            pages_grouped: dict[int, list] = {}
            for pg, sl in info['slots']:
                if sl not in pages_grouped.setdefault(pg, []):
                    pages_grouped[pg].append(sl)
            page_texts = []
            for pg in sorted(pages_grouped):
                slots_str = ', '.join(str(s) for s in sorted(pages_grouped[pg]))
                page_texts.append(f'Page {pg}/{overall_total_pages}: {slots_str}')
            member_blocks.append(f'<@{did}> | {event_name}: {today}\n' + '\n'.join(page_texts))

        if member_blocks:
            full_text = '\n-----\n'.join(member_blocks)
            if len(full_text) <= 1900:
                await channel.send(full_text)
            else:
                chunk = member_blocks[0]
                for block in member_blocks[1:]:
                    if len(chunk) + len(block) + 9 <= 1900:
                        chunk += '\n-----\n' + block
                    else:
                        await channel.send(chunk)
                        chunk = block
                if chunk:
                    await channel.send(chunk)

        await interaction.followup.send(
            f'ประกาศผลสำเร็จที่ {channel.mention}',
            ephemeral=True
        )

    # ─── /round_status ───────────────────────────────────────────────────
    @app_commands.command(name='round_status', description='ดูสรุปสถานะโพลและการตั้งค่าไอเทมของรอบกิจกรรม')
    @app_commands.describe(
        event='เลือกรอบกิจกรรมจากฐานข้อมูล (หากไม่เลือกจะใช้รอบล่าสุดอัตโนมัติ)',
    )
    @app_commands.autocomplete(event=event_autocomplete)
    async def round_status(
        self,
        interaction: discord.Interaction,
        event: str | None = None,
    ) -> None:
        await interaction.response.defer(ephemeral=True)
        resolved = resolve_event_key(event)
        if not resolved:
            await interaction.followup.send('ยังไม่มีรอบกิจกรรมในระบบ', ephemeral=True)
            return

        event_name, today = resolved
        res = await asyncio.to_thread(
            lambda: supabase.table('event_attendance')
            .select('status')
            .eq('event_name', event_name)
            .eq('event_date', today)
            .execute()
        )
        counts = {'want_bid': 0, 'no_bid': 0, 'absent': 0}
        for row in (res.data or []):
            s = row.get('status', '')
            if s in counts:
                counts[s] += 1

        sess_res = await asyncio.to_thread(
            lambda: supabase.table('event_sessions')
            .select('*')
            .eq('event_name', event_name)
            .eq('session_date', today)
            .execute()
        )
        sess_rows = sess_res.data or []
        is_closed = bool(sess_rows) and all(r.get('status') == 'closed' for r in sess_rows)

        embed = build_attendance_embed(event_name, today, counts, is_closed=is_closed)

        sess_map = {r['item_type']: r for r in sess_rows}
        items_summary = []
        for k in ITEM_ORDER:
            r = sess_map.get(k)
            if r and (r.get('total_quantity') or 0) > 0:
                items_summary.append(
                    f"{ITEM_LABELS[k]}: **{r['total_quantity']}** ชิ้น (ลิมิต {r['personal_limit']}) `[{r['start_page']}:{r['start_slot']}-{r['end_page']}:{r['end_slot']}]`"
                )
        if items_summary:
            embed.add_field(name='ไอเทมที่ตั้งค่าแล้ว', value='\n'.join(items_summary), inline=False)

        await interaction.followup.send(embed=embed, ephemeral=True)

    # ─── /award ──────────────────────────────────────────────────────────
    @app_commands.command(name='award', description='[Admin] บันทึกการมอบไอเทมให้สมาชิกรายบุคคล')
    @app_commands.describe(
        member='สมาชิกที่ได้รับไอเทม',
        item_type='ประเภทไอเทม',
    )
    @app_commands.choices(item_type=ITEM_CHOICES)
    async def award(
        self,
        interaction: discord.Interaction,
        member: discord.Member,
        item_type: app_commands.Choice[str],
    ) -> None:
        await interaction.response.defer(ephemeral=True)
        if not await check_admin_defer(interaction):
            return

        target_profile = await auction_service.get_profile_by_discord_id(str(member.id))
        if not target_profile:
            await interaction.followup.send(f'{member.display_name} ยังไม่ได้ลงทะเบียนในระบบ', ephemeral=True)
            return

        admin_profile = await auction_service.get_profile_by_discord_id(str(interaction.user.id))
        session_res = await asyncio.to_thread(
            lambda: supabase.table('event_sessions')
            .select('id')
            .eq('item_type', item_type.value)
            .order('session_date', desc=True)
            .limit(1)
            .execute()
        )
        found_round_id = session_res.data[0]['id'] if (session_res.data and len(session_res.data) > 0) else None

        await asyncio.to_thread(
            lambda: supabase.table('auction_history').insert({
                'round_id': found_round_id,
                'user_id': target_profile['id'],
                'item_type': item_type.value,
                'qty_awarded': 1,
                'awarded_by': admin_profile['id'] if admin_profile else None,
                'note': f'Award ผ่านคำสั่ง /award โดย {interaction.user.display_name}',
            }).execute()
        )

        iname = ITEM_LABELS.get(item_type.value, item_type.value)
        embed = discord.Embed(
            title='Award สำเร็จ',
            description=f'มอบ **{iname}** ให้ **{target_profile["display_name"]}** เรียบร้อยแล้ว',
            color=discord.Color.green()
        )
        await interaction.followup.send(embed=embed, ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(AuctionCog(bot))

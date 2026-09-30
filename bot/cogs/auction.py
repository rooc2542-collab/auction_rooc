from __future__ import annotations
import re
from datetime import date
import discord
from discord import app_commands
from discord.ext import commands
from services import auction_service
from services import allocation_service
from services.supabase_client import supabase
from views.attendance_view import EventPollView, build_attendance_embed, ITEM_LABELS

ITEM_ORDER = ['Album', 'Puppet', 'White', 'RedBlack']

ITEM_CHOICES = [
    app_commands.Choice(name='Album (สมุดการ์ด)', value='Album'),
    app_commands.Choice(name='Puppet (เศษการ์ดบอส)', value='Puppet'),
    app_commands.Choice(name='White (ขนนกขาว)', value='White'),
    app_commands.Choice(name='RedBlack (ขนนกดำแดง)', value='RedBlack'),
]


async def check_admin_defer(interaction: discord.Interaction) -> bool:
    """ตรวจสอบสิทธิ์ Admin หลัง defer แล้ว"""
    profile = await auction_service.get_profile_by_discord_id(str(interaction.user.id))
    if not profile or profile.get('role') != 'admin':
        if interaction.response.is_done():
            await interaction.followup.send('❌ คำสั่งนี้ใช้ได้เฉพาะ Admin เท่านั้น', ephemeral=True)
        else:
            await interaction.response.send_message('❌ คำสั่งนี้ใช้ได้เฉพาะ Admin เท่านั้น', ephemeral=True)
        return False
    return True


def get_db_events(limit: int = 25) -> list[tuple[str, str]]:
    """ดึงรายชื่อ (event_name, event_date) ทั้งหมดจากฐานข้อมูล เรียงจากล่าสุด"""
    seen: set[tuple[str, str]] = set()
    result: list[tuple[str, str]] = []
    try:
        s_res = supabase.table('event_sessions') \
            .select('event_name, session_date, created_at') \
            .order('created_at', desc=True) \
            .limit(100) \
            .execute()
        for r in (s_res.data or []):
            key = (r['event_name'], r['session_date'])
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
    except Exception as e:
        print(f'[AuctionCog] get_db_events error: {e}')
    return result[:limit]


def resolve_event_key(event_key: str | None) -> tuple[str, str] | None:
    """แปลงค่าจาก Autocomplete ('ชื่อ|วันที่' หรือ 'ชื่อ') หรือดึงรอบล่าสุดจาก DB"""
    # Fast path: autocomplete ส่งมาเป็น 'ชื่อ|วันที่' แล้ว — แค่ split ไม่ต้อง query DB
    if event_key and '|' in event_key:
        parts = event_key.strip().split('|', 1)
        return parts[0].strip(), parts[1].strip()

    # Slow path: ไม่มีค่า หรือพิมพ์เองโดยไม่ผ่าน autocomplete
    events = get_db_events(25)
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
    """Autocomplete ดึงชื่อรอบกิจกรรมจากฐานข้อมูลโดยตรง"""
    events = get_db_events(25)
    choices: list[app_commands.Choice[str]] = []
    q = current.lower().strip()
    for en, ed in events:
        display = f'{en} ({ed})'
        val = f'{en}|{ed}'
        if not q or q in display.lower():
            choices.append(app_commands.Choice(name=display[:100], value=val[:100]))
    return choices[:25]


def parse_item_input(raw: str) -> tuple[str, int, int, int, int, int, int]:
    """
    แปลงข้อความกรอกไอเทม รองรับ 2 รูปแบบ:
    1) 'จำนวน, ลิมิต' เช่น '16, 2' หรือ '16' หรือ '0'
    2) 'หน้าเริ่ม:ช่องเริ่ม-หน้าจบ:ช่องจบ, ลิมิต' เช่น '1:1-4:4, 2'
    คืนค่า: (mode, start_page, start_slot, end_page, end_slot, total_qty, limit)
    """
    text = (raw or '').strip()
    if not text or text == '0':
        return ('qty', 1, 1, 1, 1, 0, 1)

    parts = [p.strip() for p in text.split(',')]
    main_part = parts[0]
    limit_val = max(1, int(parts[1])) if len(parts) > 1 and parts[1].isdigit() else 1

    # ตรวจสอบรูปแบบพิกัด เช่น 1:1-4:4
    coord_match = re.match(r'^(\d+)\s*:\s*([1-4])\s*-\s*(\d+)\s*:\s*([1-4])$', main_part)
    if coord_match:
        sp = int(coord_match.group(1))
        ss = int(coord_match.group(2))
        ep = int(coord_match.group(3))
        es = int(coord_match.group(4))
        total = allocation_service.compute_total_from_coords(sp, ss, ep, es)
        return ('coord', sp, ss, ep, es, max(0, total), limit_val)

    # รูปแบบจำนวนชิ้นรวม เช่น 15, 2 หรือ 15
    qty_val = max(0, int(main_part)) if main_part.isdigit() else 0
    return ('qty', 1, 1, 1, 1, qty_val, limit_val)


class SetAllItemsModal(discord.ui.Modal):
    """Modal ตั้งค่าไอเทมทั้ง 4 ประเภทพร้อมกันในครั้งเดียว"""

    album_input = discord.ui.TextInput(
        label='📖 สมุดการ์ด (Album) — จำนวน, ลิมิต หรือ พิกัด, ลิมิต',
        placeholder='เช่น 12, 2 หรือ 1:1-3:4, 2 (ใส่ 0 ถ้าไม่มี)',
        required=True,
        max_length=40,
    )
    puppet_input = discord.ui.TextInput(
        label='🎭 เศษการ์ดบอส (Puppet) — จำนวน, ลิมิต หรือ พิกัด, ลิมิต',
        placeholder='เช่น 20, 3 หรือ 4:1-8:4, 3 (ใส่ 0 ถ้าไม่มี)',
        required=True,
        max_length=40,
    )
    white_input = discord.ui.TextInput(
        label='🪶 ขนนกขาว (White) — จำนวน, ลิมิต หรือ พิกัด, ลิมิต',
        placeholder='เช่น 16, 2 หรือ 9:1-12:4, 2 (ใส่ 0 ถ้าไม่มี)',
        required=True,
        max_length=40,
    )
    redblack_input = discord.ui.TextInput(
        label='🔴 ขนนกดำแดง (RedBlack) — จำนวน, ลิมิต หรือ พิกัด, ลิมิต',
        placeholder='เช่น 8, 1 หรือ 13:1-14:4, 1 (ใส่ 0 ถ้าไม่มี)',
        required=True,
        max_length=40,
    )

    def __init__(self, event_name: str, session_date: str, existing_map: dict[str, dict]):
        super().__init__(title=f'ตั้งค่าไอเทมทั้ง 4 ชนิด — {event_name[:20]}')
        self._event_name = event_name
        self._session_date = session_date

        def fmt_default(item_key: str) -> str:
            row = existing_map.get(item_key)
            if not row:
                return '0, 1'
            return f"{row.get('total_quantity', 0)}, {row.get('personal_limit', 1)}"

        self.album_input.default = fmt_default('Album')
        self.puppet_input.default = fmt_default('Puppet')
        self.white_input.default = fmt_default('White')
        self.redblack_input.default = fmt_default('RedBlack')

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)

        # ตรวจสอบ admin ใน on_submit แทน (เพราะเราไม่ check ก่อน send_modal)
        profile = await auction_service.get_profile_by_discord_id(str(interaction.user.id))
        if not profile or profile.get('role') != 'admin':
            await interaction.followup.send('❌ คำสั่งนี้ใช้ได้เฉพาะ Admin เท่านั้น', ephemeral=True)
            return

        # โหลดข้อมูลเดิมมา merge (ถ้ามี) — กรณีใส่ 0 จะ skip ไอเทมนั้น
        res = supabase.table('event_sessions') \
            .select('*') \
            .eq('event_name', self._event_name) \
            .eq('session_date', self._session_date) \
            .execute()
        existing_map = {r['item_type']: r for r in (res.data or [])}

        raw_map = {
            'Album': str(self.album_input),
            'Puppet': str(self.puppet_input),
            'White': str(self.white_input),
            'RedBlack': str(self.redblack_input),
        }

        try:
            running_page = 1
            running_slot = 1
            embed = discord.Embed(
                title=f'✅ บันทึกไอเทมทั้ง 4 ประเภทสำเร็จ',
                description=f'รอบกิจกรรม: **{self._event_name}** ({self._session_date})',
                color=discord.Color.green()
            )

            for item_key in ITEM_ORDER:
                mode, sp, ss, ep, es, total_qty, limit_val = parse_item_input(raw_map[item_key])

                if mode == 'qty':
                    if total_qty > 0:
                        sp = running_page
                        ss = running_slot
                        offset = (ss - 1) + total_qty - 1
                        ep = sp + (offset // 4)
                        es = (offset % 4) + 1
                        # เลื่อนพิกัดเริ่มต้นของไอเทมถัดไปต่อทันที
                        next_offset = offset + 1
                        running_page = sp + (next_offset // 4)
                        running_slot = (next_offset % 4) + 1
                    else:
                        sp, ss, ep, es = 1, 1, 1, 1
                else:
                    # กรณีระบุพิกัดชัดเจน ให้เลื่อนตัวชี้ไปต่อท้ายพิกัดนั้น
                    next_slot = es + 1
                    next_page = ep
                    if next_slot > 4:
                        next_slot = 1
                        next_page += 1
                    running_page, running_slot = next_page, next_slot

                supabase.table('event_sessions').upsert({
                    'event_name': self._event_name,
                    'session_date': self._session_date,
                    'item_type': item_key,
                    'start_page': sp,
                    'start_slot': ss,
                    'end_page': ep,
                    'end_slot': es,
                    'total_quantity': total_qty,
                    'personal_limit': limit_val,
                    'status': 'active',
                }, on_conflict='event_name,session_date,item_type').execute()

                iname = ITEM_LABELS.get(item_key, item_key)
                if total_qty > 0:
                    embed.add_field(
                        name=iname,
                        value=f'**{total_qty}** ชิ้น (Limit {limit_val}/คน)\n`Page {sp}:{ss} → {ep}:{es}`',
                        inline=True
                    )
                else:
                    embed.add_field(
                        name=iname,
                        value='ไม่มีไอเทม (0 ชิ้น)',
                        inline=True
                    )

            embed.set_footer(text='ใช้คำสั่ง /announce_allocation เพื่อคำนวณและประกาศพิกัดสล็อตได้ทันที')
            await interaction.followup.send(embed=embed, ephemeral=True)
        except Exception as e:
            await interaction.followup.send(f'❌ เกิดข้อผิดพลาดในการบันทึก: {e}', ephemeral=True)


class AuctionCog(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

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

        # สร้างรายการตั้งต้นทั้ง 4 ไอเทมลงฐานข้อมูลทันที เพื่อให้คำสั่งอื่นและหน้าเว็บดึงชื่อรอบนี้ไปใช้ต่อได้ทันที
        for item_key in ITEM_ORDER:
            supabase.table('event_sessions').upsert({
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
            }, on_conflict='event_name,session_date,item_type').execute()

        embed = build_attendance_embed(clean_name, today)
        view = EventPollView(clean_name, today)
        await channel.send(embed=embed, view=view)

        await interaction.followup.send(
            f'✅ เปิดโพลและบันทึกรอบลงระบบเรียบร้อยที่ {channel.mention}\n'
            f'📌 รอบกิจกรรม: **{clean_name}** ({today})\n'
            f'💡 ขั้นตอนถัดไป: ใช้คำสั่ง `/set_items` เพื่อกรอกจำนวนไอเทมทั้ง 4 ประเภทในครั้งเดียว',
            ephemeral=True
        )

    # ─── /set_items (ตั้งค่าทั้ง 4 ประเภทในครั้งเดียว) ───────────────────────
    @app_commands.command(name='set_items', description='[Admin] ตั้งค่าจำนวนและลิมิตไอเทมทั้ง 4 ประเภทพร้อมกันในครั้งเดียว')
    @app_commands.describe(
        event='เลือกรอบกิจกรรมจากฐานข้อมูล (หากไม่เลือกจะใช้รอบล่าสุดอัตโนมัติ)',
    )
    @app_commands.autocomplete(event=event_autocomplete)
    async def set_items(
        self,
        interaction: discord.Interaction,
        event: str | None = None,
    ) -> None:
        # ต้อง send_modal ทันที ห้าม query DB ก่อน เพราะ Discord timeout 3 วินาที
        resolved = resolve_event_key(event)
        if not resolved:
            await interaction.response.send_message(
                '❌ ยังไม่มีรอบกิจกรรมในระบบ กรุณาเปิดโพลด้วย `/event_poll` ก่อนครับ',
                ephemeral=True
            )
            return

        event_name, session_date = resolved
        # ส่ง modal ทันที ไม่รอ DB (on_submit จะ check admin + load existing)
        modal = SetAllItemsModal(event_name, session_date, {})
        await interaction.response.send_modal(modal)

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
            await interaction.followup.send('❌ ไม่พบรอบกิจกรรมที่ต้องการลบ', ephemeral=True)
            return

        event_name, event_date = resolved
        try:
            supabase.table('allocated_slots').delete().eq('event_name', event_name).eq('session_date', event_date).execute()
            supabase.table('event_attendance').delete().eq('event_name', event_name).eq('event_date', event_date).execute()
            supabase.table('event_sessions').delete().eq('event_name', event_name).eq('session_date', event_date).execute()

            await interaction.followup.send(
                f'🗑️ ลบรอบกิจกรรม **{event_name}** ({event_date}) ออกจากฐานข้อมูลเรียบร้อยแล้วครับ',
                ephemeral=True
            )
        except Exception as e:
            await interaction.followup.send(f'❌ ลบไม่สำเร็จ: {e}', ephemeral=True)

    # ─── /announce_allocation ────────────────────────────────────────────
    @app_commands.command(name='announce_allocation', description='[Admin] คำนวณและประกาศผลการจัดสรรสล็อตลงห้องแชท')
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
            await interaction.followup.send('❌ ยังไม่มีรอบกิจกรรมในระบบ', ephemeral=True)
            return

        event_name, today = resolved

        sessions_res = supabase.table('event_sessions').select('*') \
            .eq('event_name', event_name).eq('session_date', today) \
            .eq('status', 'active').execute()
        sessions = [s for s in (sessions_res.data or []) if (s.get('total_quantity') or 0) > 0]

        if not sessions:
            await interaction.followup.send(
                f'❌ ยังไม่ได้กำหนดจำนวนไอเทมสำหรับ **{event_name}** ({today})\n'
                f'กรุณาใช้คำสั่ง `/set_items` เพื่อระบุจำนวนไอเทมก่อนครับ',
                ephemeral=True
            )
            return

        overall_total_pages = max((s.get('end_page', 1) for s in sessions), default=1)
        header_embed = discord.Embed(
            title=f'📋 ผลการจัดสรรสล็อต — {event_name}',
            description=f'📅 {today} | ประกาศโดย {interaction.user.display_name}',
            color=discord.Color.gold()
        )

        combined_member_slots: dict[str, dict] = {}

        no_bid_res = supabase.table('event_attendance') \
            .select('user_id') \
            .eq('event_name', event_name) \
            .eq('event_date', today) \
            .eq('status', 'no_bid') \
            .execute()
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

            for uid in no_bid_users:
                await credit_service.add_credit(uid, item_type, personal_limit)

            members = await allocation_service.get_event_attendees(event_name, today, item_type)

            if not members:
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

            for s in slots:
                did = s['discord_id']
                if did not in combined_member_slots:
                    combined_member_slots[did] = {'name': s['display_name'], 'uid': did, 'slots': []}
                combined_member_slots[did]['slots'].append((s['page'], s['slot']))

            header_embed.add_field(
                name=f'{iname}',
                value=f'จำนวน {total_qty} ชิ้น | {len(members)} คนขอ | Limit {personal_limit}/คน',
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
            f'✅ ประกาศผลสำเร็จที่ {channel.mention}',
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
            await interaction.followup.send('❌ ยังไม่มีรอบกิจกรรมในระบบ', ephemeral=True)
            return

        event_name, today = resolved
        res = supabase.table('event_attendance').select('status') \
            .eq('event_name', event_name).eq('event_date', today).execute()
        counts = {'want_bid': 0, 'no_bid': 0, 'absent': 0}
        for row in (res.data or []):
            s = row.get('status', '')
            if s in counts:
                counts[s] += 1

        embed = build_attendance_embed(event_name, today, counts)

        sess_res = supabase.table('event_sessions').select('*') \
            .eq('event_name', event_name).eq('session_date', today).execute()
        sess_map = {r['item_type']: r for r in (sess_res.data or [])}
        items_summary = []
        for k in ITEM_ORDER:
            r = sess_map.get(k)
            if r and (r.get('total_quantity') or 0) > 0:
                items_summary.append(
                    f"{ITEM_LABELS[k]}: **{r['total_quantity']}** ชิ้น (Limit {r['personal_limit']}) `[{r['start_page']}:{r['start_slot']}-{r['end_page']}:{r['end_slot']}]`"
                )
        if items_summary:
            embed.add_field(name='📦 ไอเทมที่ตั้งค่าแล้ว', value='\n'.join(items_summary), inline=False)

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
            await interaction.followup.send(f'❌ {member.display_name} ยังไม่ได้ลงทะเบียนในระบบ', ephemeral=True)
            return

        admin_profile = await auction_service.get_profile_by_discord_id(str(interaction.user.id))
        supabase.table('auction_history').insert({
            'user_id': target_profile['id'],
            'item_type': item_type.value,
            'qty_awarded': 1,
            'awarded_by': admin_profile['id'] if admin_profile else None,
            'note': f'Award ผ่านคำสั่ง /award โดย {interaction.user.display_name}',
        }).execute()

        iname = ITEM_LABELS.get(item_type.value, item_type.value)
        embed = discord.Embed(
            title='🎁 Award สำเร็จ',
            description=f'มอบ **{iname}** ให้ **{target_profile["display_name"]}** เรียบร้อยแล้ว',
            color=discord.Color.green()
        )
        await interaction.followup.send(embed=embed, ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(AuctionCog(bot))

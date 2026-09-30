from __future__ import annotations
import asyncio
from datetime import date, datetime, timezone
import discord
from services.supabase_client import supabase
from services import auction_service

ITEM_LABELS = {
    'Album': 'สมุดการ์ด',
    'Puppet': 'เศษการ์ดบอส',
    'White': 'ขนนกขาว',
    'RedBlack': 'ขนนกดำแดง',
}

ITEM_KEYS = list(ITEM_LABELS.keys())


def is_poll_closed_sync(event_name: str, event_date: str) -> bool:
    """ตรวจสอบว่าโพลของรอบนี้ถูกปิดหรือยัง (ดูจาก event_sessions.status == 'closed')"""
    res = supabase.table('event_sessions') \
        .select('status') \
        .eq('event_name', event_name) \
        .eq('session_date', event_date) \
        .limit(4) \
        .execute()
    rows = res.data or []
    if not rows:
        return False
    return all(r.get('status') == 'closed' for r in rows)


def close_poll_in_db_sync(event_name: str, event_date: str) -> None:
    """บันทึกสถานะปิดโหวตลงตาราง event_sessions"""
    supabase.table('event_sessions') \
        .update({'status': 'closed'}) \
        .eq('event_name', event_name) \
        .eq('session_date', event_date) \
        .execute()


def build_attendance_embed(
    event_name: str,
    event_date: str,
    counts: dict | None = None,
    is_closed: bool = False,
    closed_by: str | None = None,
) -> discord.Embed:
    if counts is None:
        counts = {'want_bid': 0, 'no_bid': 0, 'absent': 0}
    total = sum(counts.values())
    embed = discord.Embed(
        title=f'{event_name}',
        description=f'วันที่: {event_date}',
        color=discord.Color.greyple() if is_closed else discord.Color.blue(),
    )
    wb = counts.get('want_bid', 0)
    nb = counts.get('no_bid', 0)
    ab = counts.get('absent', 0)
    embed.add_field(
        name='เข้าร่วม / ต้องการประมูล',
        value=f'{wb} คน ({wb*100//total if total else 0}%)',
        inline=False
    )
    embed.add_field(
        name='เข้าร่วม / ไม่ต้องการประมูล',
        value=f'{nb} คน ({nb*100//total if total else 0}%)',
        inline=False
    )
    embed.add_field(
        name='ไม่ประสงค์เข้าร่วม',
        value=f'{ab} คน ({ab*100//total if total else 0}%)',
        inline=False
    )
    if is_closed:
        by_text = f' โดย {closed_by}' if closed_by else ''
        embed.set_footer(text=f'รวม {total} คน • ปิดโหวตแล้ว{by_text}')
    else:
        embed.set_footer(text=f'รวม {total} คน • กดปุ่มด้านล่างเพื่อลงชื่อ')
    return embed


def extract_event_from_message(message: discord.Message | None, fallback_encoded: str = '') -> tuple[str, str]:
    """ดึงชื่ออีเวนต์และวันที่จาก Embed ของโพล หรือจาก custom_id สำรอง"""
    if message and message.embeds:
        emb = message.embeds[0]
        title = (emb.title or '').removeprefix('⚔️ ').strip()
        desc = (emb.description or '').removeprefix('📅 ').removeprefix('วันที่: ').strip()
        if title and desc:
            return title, desc
    if fallback_encoded and '|' in fallback_encoded:
        parts = fallback_encoded.split('|', 1)
        return parts[0], parts[1]
    return 'Event', str(date.today())


async def refresh_poll_message(message: discord.Message | None, event_name: str, event_date: str) -> None:
    if not message:
        return
    try:
        res = await asyncio.to_thread(
            lambda: supabase.table('event_attendance')
            .select('status')
            .eq('event_name', event_name)
            .eq('event_date', event_date)
            .execute()
        )
        counts = {'want_bid': 0, 'no_bid': 0, 'absent': 0}
        for row in (res.data or []):
            s = row.get('status', '')
            if s in counts:
                counts[s] += 1
        closed = await asyncio.to_thread(is_poll_closed_sync, event_name, event_date)
        embed = build_attendance_embed(event_name, event_date, counts, is_closed=closed)
        await message.edit(embed=embed)
    except Exception as e:
        print(f'[AttendanceView] refresh_poll_message error: {e}')


class ItemSelectView(discord.ui.View):
    """View ให้เลือกไอเทมที่ต้องการประมูล"""
    def __init__(self, event_name: str, event_date: str, discord_id: str, user_id: str, current_items: list, poll_message: discord.Message | None = None):
        super().__init__(timeout=180)
        self.add_item(ItemMultiSelect(event_name, event_date, discord_id, user_id, current_items, poll_message))


class ItemMultiSelect(discord.ui.Select):
    def __init__(self, event_name: str, event_date: str, discord_id: str, user_id: str, current_items: list, poll_message: discord.Message | None = None):
        self._event = event_name
        self._date = event_date
        self._discord_id = discord_id
        self._user_id = user_id
        self._poll_message = poll_message
        options = [
            discord.SelectOption(label=lbl, value=key, default=(key in current_items))
            for key, lbl in ITEM_LABELS.items()
        ]
        super().__init__(
            placeholder='เลือกไอเทมที่ต้องการประมูล (เลือกได้หลายชิ้น)...',
            min_values=1,
            max_values=4,
            options=options,
            custom_id=f'item_select_{discord_id}'
        )

    async def callback(self, interaction: discord.Interaction):
        if str(interaction.user.id) != self._discord_id:
            await interaction.response.send_message('นี่ไม่ใช่เมนูของคุณ', ephemeral=True)
            return

        await interaction.response.defer(ephemeral=True)

        if await asyncio.to_thread(is_poll_closed_sync, self._event, self._date):
            await interaction.followup.send('โพลรอบนี้ปิดโหวตแล้ว ไม่สามารถแก้ไขข้อมูลได้', ephemeral=True)
            return

        selected = self.values
        try:
            await asyncio.to_thread(
                lambda: supabase.table('event_attendance').upsert({
                    'event_name': self._event,
                    'event_date': self._date,
                    'discord_id': self._discord_id,
                    'user_id': self._user_id,
                    'status': 'want_bid',
                    'interested_items': selected,
                    'updated_at': datetime.now(timezone.utc).isoformat()
                }, on_conflict='event_name,event_date,discord_id').execute()
            )

            items_text = ', '.join(ITEM_LABELS.get(i, i) for i in selected)
            embed = discord.Embed(
                title='บันทึกสำเร็จ',
                description=f'คุณเลือกประมูล: **{items_text}**',
                color=discord.Color.green()
            )
            self.disabled = True
            await interaction.edit_original_response(embed=embed, view=self.view)
            await refresh_poll_message(self._poll_message, self._event, self._date)
        except Exception as e:
            print(f'[ItemMultiSelect] error: {e}')
            await interaction.followup.send(f'เกิดข้อผิดพลาด: {e}', ephemeral=True)


async def handle_attendance_action(interaction: discord.Interaction, status: str, fallback_encoded: str = '') -> None:
    """ฟังก์ชันหลักสำหรับจัดการเมื่อมีคนกดปุ่มโพล"""
    await interaction.response.defer(ephemeral=True)

    event_name, event_date = extract_event_from_message(interaction.message, fallback_encoded)
    discord_id = str(interaction.user.id)

    try:
        if await asyncio.to_thread(is_poll_closed_sync, event_name, event_date):
            await interaction.followup.send(
                'โพลรอบนี้ปิดโหวตแล้ว ไม่สามารถลงชื่อหรือเปลี่ยนสถานะได้ครับ',
                ephemeral=True
            )
            return

        profile = await auction_service.get_profile_by_discord_id(discord_id)
        if not profile:
            await interaction.followup.send(
                'คุณยังไม่ได้ลงทะเบียน กรุณาพิมพ์คำสั่ง `/register` ก่อนครับ',
                ephemeral=True
            )
            return

        user_id = profile['id']

        if status == 'want_bid':
            res = await asyncio.to_thread(
                lambda: supabase.table('event_attendance')
                .select('interested_items')
                .eq('event_name', event_name)
                .eq('event_date', event_date)
                .eq('discord_id', discord_id)
                .limit(1)
                .execute()
            )
            first_row = res.data[0] if res.data else {}
            current_items = first_row.get('interested_items') or []

            view = ItemSelectView(event_name, event_date, discord_id, user_id, current_items, interaction.message)
            embed = discord.Embed(
                title='เลือกไอเทมที่ต้องการประมูล',
                description='เลือกได้มากกว่า 1 ไอเทม สามารถเปลี่ยนใจกดเลือกใหม่ได้ตลอดจนกว่าจะปิดโหวต',
                color=discord.Color.green()
            )
            await interaction.followup.send(embed=embed, view=view, ephemeral=True)
        else:
            await asyncio.to_thread(
                lambda: supabase.table('event_attendance').upsert({
                    'event_name': event_name,
                    'event_date': event_date,
                    'discord_id': discord_id,
                    'user_id': user_id,
                    'status': status,
                    'interested_items': [],
                    'updated_at': datetime.now(timezone.utc).isoformat()
                }, on_conflict='event_name,event_date,discord_id').execute()
            )

            label_map = {
                'no_bid': 'เข้าร่วม / ไม่ต้องการประมูล (สะสมแต้มลัดคิวรอบหน้า)',
                'absent': 'ไม่ประสงค์เข้าร่วม'
            }
            await interaction.followup.send(
                f'บันทึกแล้ว: **{label_map.get(status, status)}**',
                ephemeral=True
            )
            await refresh_poll_message(interaction.message, event_name, event_date)
    except Exception as e:
        print(f'[AttendanceView] handle_attendance_action error: {e}')
        await interaction.followup.send(f'เกิดข้อผิดพลาด: {e}', ephemeral=True)


async def handle_close_event_action(interaction: discord.Interaction, fallback_encoded: str = '') -> None:
    """ฟังก์ชันสำหรับปุ่มปิดรับโพล [Admin]"""
    await interaction.response.defer(ephemeral=True)
    discord_id = str(interaction.user.id)
    profile = await auction_service.get_profile_by_discord_id(discord_id)
    if not profile or profile.get('role') != 'admin':
        await interaction.followup.send('เฉพาะ Admin เท่านั้นที่ปิดโหวตได้', ephemeral=True)
        return

    event_name, event_date = extract_event_from_message(interaction.message, fallback_encoded)

    try:
        await asyncio.to_thread(close_poll_in_db_sync, event_name, event_date)

        # อัปเดต cache ใน auction cog ด้วยถ้ามี
        try:
            from cogs.auction import _SESSIONS_CACHE
            if (event_name, event_date) in _SESSIONS_CACHE:
                for row in _SESSIONS_CACHE[(event_name, event_date)].values():
                    row['status'] = 'closed'
        except Exception:
            pass

        res = await asyncio.to_thread(
            lambda: supabase.table('event_attendance')
            .select('status')
            .eq('event_name', event_name)
            .eq('event_date', event_date)
            .execute()
        )
        counts = {'want_bid': 0, 'no_bid': 0, 'absent': 0}
        for row in (res.data or []):
            s = row.get('status', '')
            if s in counts:
                counts[s] += 1

        embed = build_attendance_embed(
            event_name,
            event_date,
            counts,
            is_closed=True,
            closed_by=interaction.user.display_name,
        )

        disabled_view = EventPollView(event_name, event_date, disabled=True)
        if interaction.message:
            await interaction.message.edit(embed=embed, view=disabled_view)

        await interaction.followup.send(
            f'ปิดโหวตรอบ **{event_name}** ({event_date}) เรียบร้อยแล้ว ตอนนี้สามารถใช้คำสั่ง `/announce_allocation` เพื่อแจ้งผลให้สมาชิกได้เลยครับ',
            ephemeral=True
        )
    except Exception as e:
        print(f'[AttendanceView] handle_close_event_action error: {e}')
        await interaction.followup.send(f'เกิดข้อผิดพลาด: {e}', ephemeral=True)


class EventPollView(discord.ui.View):
    """Persistent View สำหรับโพลนับคนเข้าร่วมวอร์ (ทำงานได้แม้บอทรีสตาร์ท)"""
    def __init__(self, event_name: str = '', event_date: str = '', disabled: bool = False):
        super().__init__(timeout=None)
        self.event_name = event_name
        self.event_date = event_date

        for child in self.children:
            if isinstance(child, discord.ui.Button):
                child.disabled = disabled

    @discord.ui.button(
        label='เข้าร่วม / ต้องการประมูล',
        style=discord.ButtonStyle.success,
        custom_id='poll_btn_want_bid',
        row=0
    )
    async def btn_want_bid(self, interaction: discord.Interaction, button: discord.ui.Button):
        await handle_attendance_action(interaction, 'want_bid')

    @discord.ui.button(
        label='เข้าร่วม / ไม่ต้องการประมูล',
        style=discord.ButtonStyle.secondary,
        custom_id='poll_btn_no_bid',
        row=0
    )
    async def btn_no_bid(self, interaction: discord.Interaction, button: discord.ui.Button):
        await handle_attendance_action(interaction, 'no_bid')

    @discord.ui.button(
        label='ไม่ประสงค์เข้าร่วม',
        style=discord.ButtonStyle.danger,
        custom_id='poll_btn_absent',
        row=0
    )
    async def btn_absent(self, interaction: discord.Interaction, button: discord.ui.Button):
        await handle_attendance_action(interaction, 'absent')

    @discord.ui.button(
        label='ปิดโหวต [Admin]',
        style=discord.ButtonStyle.primary,
        custom_id='poll_btn_close',
        row=1
    )
    async def btn_close(self, interaction: discord.Interaction, button: discord.ui.Button):
        await handle_close_event_action(interaction)

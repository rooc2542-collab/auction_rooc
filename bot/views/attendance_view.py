from __future__ import annotations
import discord
from datetime import date
from services.supabase_client import supabase
from services import auction_service

ITEM_LABELS = {
    'Album': '📖 สมุดการ์ด',
    'Puppet': '🎭 เศษการ์ดบอส',
    'White': '🪶 ขนนกขาว',
    'RedBlack': '🔴 ขนนกดำแดง',
}

ITEM_KEYS = list(ITEM_LABELS.keys())


def build_attendance_embed(event_name: str, event_date: str, counts: dict | None = None) -> discord.Embed:
    if counts is None:
        counts = {'want_bid': 0, 'no_bid': 0, 'absent': 0}
    total = sum(counts.values())
    embed = discord.Embed(
        title=f'⚔️ {event_name}',
        description=f'📅 {event_date}',
        color=discord.Color.blue(),
    )
    wb = counts.get('want_bid', 0)
    nb = counts.get('no_bid', 0)
    ab = counts.get('absent', 0)
    embed.add_field(
        name='🎮 Join the war / Want to bid',
        value=f'{wb} คน ({wb*100//total if total else 0}%)',
        inline=False
    )
    embed.add_field(
        name='🚫 Join the war / Do not want to bid',
        value=f'{nb} คน ({nb*100//total if total else 0}%)',
        inline=False
    )
    embed.add_field(
        name='⛔ Unable to attend',
        value=f'{ab} คน ({ab*100//total if total else 0}%)',
        inline=False
    )
    embed.set_footer(text=f'{total} คน • กดปุ่มด้านล่างเพื่อตอบรับ')
    return embed


class ItemSelectView(discord.ui.View):
    """View ให้เลือกไอเทมที่ต้องการ"""
    def __init__(self, event_name: str, event_date: str, discord_id: str, user_id: str, current_items: list, poll_message: discord.Message | None = None):
        super().__init__(timeout=120)
        self._event = event_name
        self._date = event_date
        self._discord_id = discord_id
        self._user_id = user_id
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
            placeholder='เลือกไอเทมที่ต้องการประมูล...',
            min_values=1,
            max_values=4,
            options=options,
            custom_id=f'item_select_{discord_id}'
        )

    async def callback(self, interaction: discord.Interaction):
        if str(interaction.user.id) != self._discord_id:
            await interaction.response.send_message('❌ นี่ไม่ใช่การเลือกของคุณ', ephemeral=True)
            return

        selected = self.values
        try:
            supabase.table('event_attendance').upsert({
                'event_name': self._event,
                'event_date': self._date,
                'discord_id': self._discord_id,
                'user_id': self._user_id,
                'status': 'want_bid',
                'interested_items': selected,
                'updated_at': 'now()'
            }, on_conflict='event_name,event_date,discord_id').execute()

            items_text = ', '.join(ITEM_LABELS.get(i, i) for i in selected)
            embed = discord.Embed(
                title='✅ บันทึกสำเร็จ!',
                description=f'คุณเลือกประมูล: **{items_text}**',
                color=discord.Color.green()
            )
            self.disabled = True
            await interaction.response.edit_message(embed=embed, view=self.view)

            # อัปเดตตัวเลขบนโพลหลักทันที
            if self._poll_message:
                try:
                    res = supabase.table('event_attendance') \
                        .select('status').eq('event_name', self._event).eq('event_date', self._date).execute()
                    counts = {'want_bid': 0, 'no_bid': 0, 'absent': 0}
                    for row in (res.data or []):
                        s = row.get('status', '')
                        if s in counts:
                            counts[s] += 1
                    poll_embed = build_attendance_embed(self._event, self._date, counts)
                    await self._poll_message.edit(embed=poll_embed)
                except Exception:
                    pass
        except Exception as e:
            await interaction.response.send_message(f'❌ เกิดข้อผิดพลาด: {e}', ephemeral=True)


class AttendanceView(discord.ui.View):
    """View ปุ่มนับคนเข้าร่วมวอร์ (persistent)"""

    def __init__(self):
        super().__init__(timeout=None)

    async def _get_round_info(self, message_id: str) -> dict | None:
        res = supabase.table('event_attendance') \
            .select('event_name, event_date') \
            .limit(1) \
            .execute()
        # ดึง event จาก message embed (ใช้ message_id ตรวจ)
        # เก็บใน metadata table หรือ encodeใน custom_id
        return None

    async def _handle_vote(self, interaction: discord.Interaction, status: str, event_name: str, event_date: str):
        discord_id = str(interaction.user.id)
        profile = await auction_service.get_profile_by_discord_id(discord_id)
        if not profile:
            await interaction.response.send_message(
                '❌ คุณยังไม่ได้ลงทะเบียน กรุณาใช้คำสั่ง /register ก่อน',
                ephemeral=True
            )
            return

        user_id = profile['id']

        if status == 'want_bid':
            # ดึง interested_items เดิม
            existing = supabase.table('event_attendance') \
                .select('interested_items') \
                .eq('event_name', event_name) \
                .eq('event_date', event_date) \
                .eq('discord_id', discord_id) \
                .maybeSingle() \
                .execute()
            current_items = (existing.data or {}).get('interested_items') or []
            # แสดง item select
            view = ItemSelectView(event_name, event_date, discord_id, user_id, current_items)
            embed = discord.Embed(
                title='🎯 เลือกไอเทมที่ต้องการประมูล',
                description='เลือกได้มากกว่า 1 ไอเทม สามารถเปลี่ยนใจได้จนกว่าจะปิดรับ',
                color=discord.Color.green()
            )
            await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
        else:
            # no_bid หรือ absent
            try:
                supabase.table('event_attendance').upsert({
                    'event_name': event_name,
                    'event_date': event_date,
                    'discord_id': discord_id,
                    'user_id': user_id,
                    'status': status,
                    'interested_items': [],
                    'updated_at': 'now()'
                }, on_conflict='event_name,event_date,discord_id').execute()

                # ถ้า no_bid -> เพิ่ม credit (logic ใน auction_service)
                if status == 'no_bid':
                    from services import credit_service
                    # Credit เพิ่มในแต่ละไอเทมที่เลือกไว้
                    # เนื่องจากเปลี่ยนเป็น no_bid ไม่รู้ไอเทม -> เพิ่มทุก item ที่มี limit
                    pass  # credit จัดการตอน announce_allocation

                label_map = {
                    'no_bid': '📦 Join the war / Do not want to bid',
                    'absent': '⛔ Unable to attend'
                }
                await interaction.response.send_message(
                    f'✅ บันทึกแล้ว: **{label_map.get(status, status)}**',
                    ephemeral=True
                )

                # อัปเดต embed นับใหม่
                await self._refresh_embed(interaction, event_name, event_date)

            except Exception as e:
                await interaction.response.send_message(f'❌ เกิดข้อผิดพลาด: {e}', ephemeral=True)

    async def _refresh_embed(self, interaction: discord.Interaction, event_name: str, event_date: str):
        try:
            res = supabase.table('event_attendance') \
                .select('status') \
                .eq('event_name', event_name) \
                .eq('event_date', event_date) \
                .execute()
            counts = {'want_bid': 0, 'no_bid': 0, 'absent': 0}
            for row in (res.data or []):
                s = row.get('status', '')
                if s in counts:
                    counts[s] += 1
            embed = build_attendance_embed(event_name, event_date, counts)
            await interaction.message.edit(embed=embed)
        except Exception:
            pass

    # ปุ่มทั้งหมดจะถูกเพิ่มแบบ dynamic ผ่าน EventPollView แทน


class EventPollView(discord.ui.View):
    """View สำหรับโพลนับคน ส่ง event_name+date ผ่าน custom_id"""
    def __init__(self, event_name: str, event_date: str):
        super().__init__(timeout=None)
        self.event_name = event_name
        self.event_date = event_date
        # custom_id encode event_name|event_date
        encoded = f'{event_name}|{event_date}'
        self.add_item(AttendanceButton('🎮 Join the war / Want to bid', discord.ButtonStyle.success, 'want_bid', encoded))
        self.add_item(AttendanceButton('🚫 Join the war / Do not want to bid', discord.ButtonStyle.secondary, 'no_bid', encoded))
        self.add_item(AttendanceButton('⛔ Unable to attend', discord.ButtonStyle.danger, 'absent', encoded))
        self.add_item(CloseEventButton(encoded))


class AttendanceButton(discord.ui.Button):
    def __init__(self, label: str, style: discord.ButtonStyle, status: str, encoded: str):
        super().__init__(
            label=label,
            style=style,
            custom_id=f'attend_{status}_{encoded[:50]}'
        )
        self._status = status
        self._encoded = encoded

    async def callback(self, interaction: discord.Interaction):
        # decode
        parts = self._encoded.split('|')
        event_name = parts[0] if parts else 'Event'
        event_date = parts[1] if len(parts) > 1 else str(date.today())

        discord_id = str(interaction.user.id)
        profile = await auction_service.get_profile_by_discord_id(discord_id)
        if not profile:
            await interaction.response.send_message('❌ คุณยังไม่ได้ลงทะเบียน ใช้ /register ก่อน', ephemeral=True)
            return

        user_id = profile['id']

        if self._status == 'want_bid':
            existing = supabase.table('event_attendance') \
                .select('interested_items') \
                .eq('event_name', event_name) \
                .eq('event_date', event_date) \
                .eq('discord_id', discord_id) \
                .maybeSingle().execute()
            current_items = (existing.data or {}).get('interested_items') or []
            view = ItemSelectView(event_name, event_date, discord_id, user_id, current_items, interaction.message)
            embed = discord.Embed(
                title='🎯 เลือกไอเทมที่ต้องการประมูล',
                description='เลือกได้มากกว่า 1 ไอเทม สามารถเปลี่ยนใจกดใหม่ได้ตลอด',
                color=discord.Color.green()
            )
            await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
        else:
            supabase.table('event_attendance').upsert({
                'event_name': event_name,
                'event_date': event_date,
                'discord_id': discord_id,
                'user_id': user_id,
                'status': self._status,
                'interested_items': [],
                'updated_at': 'now()'
            }, on_conflict='event_name,event_date,discord_id').execute()

            label_map = {'no_bid': '🚫 Join / Do not bid', 'absent': '⛔ Unable to attend'}
            await interaction.response.send_message(f'✅ บันทึกแล้ว: **{label_map.get(self._status, self._status)}**', ephemeral=True)

            # อัปเดต embed
            try:
                res = supabase.table('event_attendance') \
                    .select('status').eq('event_name', event_name).eq('event_date', event_date).execute()
                counts = {'want_bid': 0, 'no_bid': 0, 'absent': 0}
                for row in (res.data or []):
                    s = row.get('status', '')
                    if s in counts:
                        counts[s] += 1
                embed = build_attendance_embed(event_name, event_date, counts)
                await interaction.message.edit(embed=embed)
            except Exception:
                pass


class CloseEventButton(discord.ui.Button):
    def __init__(self, encoded: str):
        super().__init__(
            label='🔒 ปิดรับ [Admin]',
            style=discord.ButtonStyle.primary,
            custom_id=f'close_event_{encoded[:50]}',
            row=1
        )
        self._encoded = encoded

    async def callback(self, interaction: discord.Interaction):
        discord_id = str(interaction.user.id)
        profile = await auction_service.get_profile_by_discord_id(discord_id)
        if not profile or profile.get('role') != 'admin':
            await interaction.response.send_message('❌ เฉพาะ Admin เท่านั้น', ephemeral=True)
            return

        for child in self.view.children:
            child.disabled = True
        parts = self._encoded.split('|')
        event_name = parts[0] if parts else 'Event'
        event_date = parts[1] if len(parts) > 1 else ''

        res = supabase.table('event_attendance').select('status') \
            .eq('event_name', event_name).eq('event_date', event_date).execute()
        counts = {'want_bid': 0, 'no_bid': 0, 'absent': 0}
        for row in (res.data or []):
            s = row.get('status', '')
            if s in counts:
                counts[s] += 1
        embed = build_attendance_embed(event_name, event_date, counts)
        embed.set_footer(text=f'โพลปิดรับแล้ว | ปิดโดย {interaction.user.display_name}')
        embed.color = discord.Color.greyple()
        await interaction.response.edit_message(embed=embed, view=self.view)

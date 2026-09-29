from __future__ import annotations
import discord
from discord import app_commands
from discord.ext import commands
from datetime import date
from services import auction_service
from services import allocation_service
from views.attendance_view import EventPollView, build_attendance_embed, ITEM_LABELS

ITEM_CHOICES = [
    app_commands.Choice(name='Album (สมุดการ์ด)', value='Album'),
    app_commands.Choice(name='Puppet (เศษการ์ดบอส)', value='Puppet'),
    app_commands.Choice(name='White (ขนนกขาว)', value='White'),
    app_commands.Choice(name='RedBlack (ขนนกดำแดง)', value='RedBlack'),
]

SLOT_CHOICES = [
    app_commands.Choice(name='ช่อง 1', value=1),
    app_commands.Choice(name='ช่อง 2', value=2),
    app_commands.Choice(name='ช่อง 3', value=3),
    app_commands.Choice(name='ช่อง 4', value=4),
]


async def check_admin(interaction: discord.Interaction) -> bool:
    profile = await auction_service.get_profile_by_discord_id(str(interaction.user.id))
    if not profile or profile.get('role') != 'admin':
        await interaction.response.send_message('❌ คำสั่งนี้ใช้ได้เฉพาะ Admin เท่านั้น', ephemeral=True)
        return False
    return True


class AuctionCog(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    # ─── /event_poll ─────────────────────────────────────────────────────
    @app_commands.command(name='event_poll', description='[Admin] เปิดโพลนับคนเข้าร่วมกิจกรรม/วอร์')
    @app_commands.describe(
        event_name='ชื่ออีเวนต์ เช่น Emperium Overrun',
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
        if not await check_admin(interaction):
            return

        today = event_date or str(date.today())
        embed = build_attendance_embed(event_name, today)
        view = EventPollView(event_name, today)
        msg = await channel.send(embed=embed, view=view)

        await interaction.followup.send(
            f'✅ โพสต์โพลสำเร็จที่ {channel.mention}\n'
            f'📝 ชื่ออีเวนต์: **{event_name}**\n📅 วันที่: **{today}**',
            ephemeral=True
        )

    # ─── /set_item_coords ────────────────────────────────────────────────
    @app_commands.command(name='set_item_coords', description='[Admin] ตั้งค่าไอเทมโดยระบุพิกัดหน้า/ช่องในเกม')
    @app_commands.describe(
        event_name='ชื่ออีเวนต์',
        item_type='ประเภทไอเทม',
        start_page='หน้าเริ่มต้น',
        start_slot='ช่องเริ่มต้น (1-4)',
        end_page='หน้าสิ้นสุด',
        end_slot='ช่องสิ้นสุด (1-4)',
        limit='จำนวนสูงสุดที่แต่ละคนรับได้',
        event_date='วันที่ (YYYY-MM-DD) ค่าเริ่มต้นคือวันนี้',
    )
    @app_commands.choices(item_type=ITEM_CHOICES, start_slot=SLOT_CHOICES, end_slot=SLOT_CHOICES)
    async def set_item_coords(
        self,
        interaction: discord.Interaction,
        event_name: str,
        item_type: app_commands.Choice[str],
        start_page: int,
        start_slot: app_commands.Choice[int],
        end_page: int,
        end_slot: app_commands.Choice[int],
        limit: int,
        event_date: str | None = None,
    ) -> None:
        await interaction.response.defer(ephemeral=True)
        if not await check_admin(interaction):
            return

        today = event_date or str(date.today())
        total = allocation_service.compute_total_from_coords(
            start_page, start_slot.value, end_page, end_slot.value
        )

        if total <= 0:
            await interaction.followup.send('❌ พิกัดไม่ถูกต้อง หน้าสิ้นสุดต้องมากกว่าหน้าเริ่มต้น', ephemeral=True)
            return

        from services.supabase_client import supabase
        supabase.table('event_sessions').upsert({
            'event_name': event_name,
            'session_date': today,
            'item_type': item_type.value,
            'start_page': start_page,
            'start_slot': start_slot.value,
            'end_page': end_page,
            'end_slot': end_slot.value,
            'total_quantity': total,
            'personal_limit': limit,
            'status': 'active',
        }, on_conflict='event_name,session_date,item_type').execute()

        iname = ITEM_LABELS.get(item_type.value, item_type.value)
        embed = discord.Embed(title='✅ บันทึกข้อมูลไอเทมสำเร็จ', color=discord.Color.green())
        embed.add_field(name='📦 ไอเทม', value=iname, inline=True)
        embed.add_field(name='🔢 จำนวน', value=f'{total} ชิ้น', inline=True)
        embed.add_field(name='👤 Limit', value=f'{limit} ต่อคน', inline=True)
        embed.add_field(
            name='📍 พิกัด',
            value=f'หน้า {start_page} ช่อง {start_slot.value} → หน้า {end_page} ช่อง {end_slot.value}',
            inline=False
        )
        await interaction.followup.send(embed=embed, ephemeral=True)

    # ─── /set_item_qty ───────────────────────────────────────────────────
    @app_commands.command(name='set_item_qty', description='[Admin] ตั้งค่าไอเทมโดยระบุจำนวนชิ้นรวมโดยตรง')
    @app_commands.describe(
        event_name='ชื่ออีเวนต์',
        item_type='ประเภทไอเทม',
        total_qty='จำนวนชิ้นรวม',
        limit='จำนวนสูงสุดที่แต่ละคนรับได้',
        event_date='วันที่ (YYYY-MM-DD) ค่าเริ่มต้นคือวันนี้',
    )
    @app_commands.choices(item_type=ITEM_CHOICES)
    async def set_item_qty(
        self,
        interaction: discord.Interaction,
        event_name: str,
        item_type: app_commands.Choice[str],
        total_qty: int,
        limit: int,
        event_date: str | None = None,
    ) -> None:
        await interaction.response.defer(ephemeral=True)
        if not await check_admin(interaction):
            return

        if total_qty <= 0 or limit <= 0:
            await interaction.followup.send('❌ จำนวนต้องมากกว่า 0', ephemeral=True)
            return

        today = event_date or str(date.today())
        from services.supabase_client import supabase
        supabase.table('event_sessions').upsert({
            'event_name': event_name,
            'session_date': today,
            'item_type': item_type.value,
            'start_page': 1, 'start_slot': 1,
            'end_page': (total_qty - 1) // 4 + 1,
            'end_slot': ((total_qty - 1) % 4) + 1,
            'total_quantity': total_qty,
            'personal_limit': limit,
            'status': 'active',
        }, on_conflict='event_name,session_date,item_type').execute()

        iname = ITEM_LABELS.get(item_type.value, item_type.value)
        embed = discord.Embed(title='✅ บันทึกข้อมูลไอเทมสำเร็จ', color=discord.Color.green())
        embed.add_field(name='📦 ไอเทม', value=iname, inline=True)
        embed.add_field(name='🔢 จำนวน', value=f'{total_qty} ชิ้น', inline=True)
        embed.add_field(name='👤 Limit', value=f'{limit} ต่อคน', inline=True)
        await interaction.followup.send(embed=embed, ephemeral=True)

    # ─── /announce_allocation ────────────────────────────────────────────
    @app_commands.command(name='announce_allocation', description='[Admin] คำนวณและประกาศผลการจัดสรรสล็อต')
    @app_commands.describe(
        event_name='ชื่ออีเวนต์',
        channel='ช่องที่จะประกาศผล',
        event_date='วันที่ (YYYY-MM-DD) ค่าเริ่มต้นคือวันนี้',
    )
    async def announce_allocation(
        self,
        interaction: discord.Interaction,
        event_name: str,
        channel: discord.TextChannel,
        event_date: str | None = None,
    ) -> None:
        await interaction.response.defer(ephemeral=True)
        if not await check_admin(interaction):
            return

        today = event_date or str(date.today())
        from services.supabase_client import supabase

        # ดึง sessions ทั้งหมดของวันนี้
        sessions_res = supabase.table('event_sessions').select('*') \
            .eq('event_name', event_name).eq('session_date', today) \
            .eq('status', 'active').execute()
        sessions = sessions_res.data or []

        if not sessions:
            await interaction.followup.send(
                f'❌ ไม่พบข้อมูลไอเทมสำหรับ **{event_name}** วันที่ {today}\n'
                f'กรุณาใช้ /set_item_coords หรือ /set_item_qty ก่อน',
                ephemeral=True
            )
            return

        # ประมวลผลทุก item type
        all_announcements: list[str] = []
        header_embed = discord.Embed(
            title=f'📋 ผลการจัดสรรสล็อต — {event_name}',
            description=f'📅 {today} | ประกาศโดย {interaction.user.display_name}',
            color=discord.Color.gold()
        )

        for session in sessions:
            item_type = session['item_type']
            total_qty = session['total_quantity']
            personal_limit = session['personal_limit']
            start_page = session['start_page']
            start_slot = session['start_slot']

            iname = ITEM_LABELS.get(item_type, item_type)

            # ดึงรายชื่อสมาชิกที่ต้องการไอเทมนี้
            members = await allocation_service.get_event_attendees(event_name, today, item_type)

            if not members:
                header_embed.add_field(
                    name=f'{iname}',
                    value=f'จำนวน {total_qty} ชิ้น | ไม่มีผู้เข้าร่วมขอไอเทมนี้',
                    inline=False
                )
                continue

            # ดึง credit map
            user_ids = [m['user_id'] for m in members]
            credit_map = await allocation_service.get_credit_map(user_ids, item_type)

            # คำนวณ allocation
            slots = allocation_service.allocate_slots(
                item_type, total_qty, personal_limit,
                start_page, start_slot, members, credit_map
            )

            # บันทึก DB
            await allocation_service.save_allocation(event_name, today, item_type, slots)

            # สร้าง announcement text แบบรูปที่ 3
            # Group by member -> list pages/slots
            member_slots: dict[str, list] = {}
            total_pages_val = slots[0]['total_pages'] if slots else start_page
            for s in slots:
                did = s['discord_id']
                if did not in member_slots:
                    member_slots[did] = {'name': s['display_name'], 'uid': did, 'slots': []}
                member_slots[did]['slots'].append((s['page'], s['slot']))

            lines = []
            for did, info in member_slots.items():
                pages_grouped: dict[int, list] = {}
                for pg, sl in info['slots']:
                    pages_grouped.setdefault(pg, []).append(sl)
                page_texts = []
                for pg in sorted(pages_grouped):
                    slots_str = ', '.join(str(s) for s in sorted(pages_grouped[pg]))
                    page_texts.append(f'Page {pg}/{total_pages_val}: {slots_str}')
                lines.append(f'<@{did}> | {event_name}: {today}\n' + '\n'.join(page_texts))

            announcement = f'**{iname}** — {len(members)} คน | จำนวน {total_qty} ชิ้น | Limit {personal_limit}/คน\n'
            announcement += '\n-----\n'.join(lines)
            all_announcements.append(announcement)

            header_embed.add_field(
                name=f'{iname}',
                value=f'จำนวน {total_qty} ชิ้น | {len(members)} คนขอ | Limit {personal_limit}/คน',
                inline=True
            )

        # โพสต์ header embed
        await channel.send(embed=header_embed)

        # โพสต์ announcement แยกไอเทม
        for ann in all_announcements:
            # Discord message limit 2000 chars
            if len(ann) <= 1900:
                await channel.send(ann)
            else:
                # แบ่งส่งหลายข้อความ
                lines = ann.split('\n-----\n')
                chunk = lines[0]
                for line in lines[1:]:
                    if len(chunk) + len(line) + 8 <= 1900:
                        chunk += '\n-----\n' + line
                    else:
                        await channel.send(chunk)
                        chunk = line
                if chunk:
                    await channel.send(chunk)

        await interaction.followup.send(
            f'✅ ประกาศผลสำเร็จที่ {channel.mention}',
            ephemeral=True
        )

    # ─── /round_status ───────────────────────────────────────────────────
    @app_commands.command(name='round_status', description='ดูสรุปสถานะโพลและการจัดสรรล่าสุด')
    @app_commands.describe(
        event_name='ชื่ออีเวนต์',
        event_date='วันที่ (YYYY-MM-DD) ค่าเริ่มต้นคือวันนี้',
    )
    async def round_status(
        self,
        interaction: discord.Interaction,
        event_name: str,
        event_date: str | None = None,
    ) -> None:
        await interaction.response.defer(ephemeral=True)
        from services.supabase_client import supabase
        today = event_date or str(date.today())

        res = supabase.table('event_attendance').select('status') \
            .eq('event_name', event_name).eq('event_date', today).execute()
        counts = {'want_bid': 0, 'no_bid': 0, 'absent': 0}
        for row in (res.data or []):
            s = row.get('status', '')
            if s in counts:
                counts[s] += 1

        embed = build_attendance_embed(event_name, today, counts)
        await interaction.followup.send(embed=embed, ephemeral=True)

    # ─── /award ──────────────────────────────────────────────────────────
    @app_commands.command(name='award', description='[Admin] บันทึกการมอบไอเทมให้สมาชิก')
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
        if not await check_admin(interaction):
            return

        target_profile = await auction_service.get_profile_by_discord_id(str(member.id))
        if not target_profile:
            await interaction.followup.send(f'❌ {member.display_name} ยังไม่ได้ลงทะเบียนในระบบ', ephemeral=True)
            return

        admin_profile = await auction_service.get_profile_by_discord_id(str(interaction.user.id))
        from services.supabase_client import supabase
        supabase.table('auction_history').insert({
            'user_id': target_profile['id'],
            'item_type': item_type.value,
            'qty_awarded': 1,
            'awarded_by': admin_profile['id'] if admin_profile else None,
            'note': f'Award ผ่านคำสั่ง /award โดย {interaction.user.display_name}',
            'awarded_at': 'now()'
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

from __future__ import annotations
import discord
from discord import app_commands
from discord.ext import commands
from services import auction_service, credit_service

JOB_CLASSES = [
    'Lord Knight','Paladin','Biochemist','Mastersmith','Bard',
    'Gypsy','Sniper','Champion','Priest','Assassin','Rogue',
    'Wizard','Sage','Summoner','Rebellion'
]

JOB_EMOJIS = {
    'Lord Knight': '⚔️', 'Paladin': '🛡️', 'Biochemist': '🧪',
    'Mastersmith': '🔨', 'Bard': '🎵', 'Gypsy': '💃',
    'Sniper': '🏹', 'Champion': '👊', 'Priest': '✝️',
    'Assassin': '🗡️', 'Rogue': '🎭', 'Wizard': '🔮',
    'Sage': '📖', 'Summoner': '🌟', 'Rebellion': '🔫'
}

# Modal สำหรับแก้ไขข้อมูล
class EditProfileModal(discord.ui.Modal, title='✏️ แก้ไขข้อมูลโปรไฟล์'):
    display_name = discord.ui.TextInput(
        label='ชื่อตัวละคร (Display Name)',
        placeholder='ชื่อที่แสดงในระบบ',
        max_length=50,
        required=True
    )

    def __init__(self, current_name: str, discord_id: str):
        super().__init__()
        self.display_name.default = current_name
        self._discord_id = discord_id

    async def on_submit(self, interaction: discord.Interaction):
        view = JobClassSelectView(self._discord_id, str(self.display_name), is_update=True)
        embed = discord.Embed(
            title='🎭 เลือกอาชีพของคุณ',
            description='กรุณาเลือกอาชีพตัวละครของคุณในเกม',
            color=discord.Color.blue()
        )
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)


class JobClassSelect(discord.ui.Select):
    def __init__(self, discord_id: str, display_name: str, is_update: bool):
        self._discord_id = discord_id
        self._display_name = display_name
        self._is_update = is_update
        options = [
            discord.SelectOption(
                label=jc,
                emoji=JOB_EMOJIS.get(jc, '⚔️'),
                value=jc
            ) for jc in JOB_CLASSES
        ]
        super().__init__(
            placeholder='เลือกอาชีพของคุณ...',
            options=options,
            custom_id='job_class_select'
        )

    async def callback(self, interaction: discord.Interaction):
        from services.supabase_client import supabase
        job_class = self.values[0]

        try:
            if self._is_update:
                update_data = {'display_name': self._display_name, 'job_class': job_class}
                supabase.table('profiles').update(update_data).eq('discord_id', self._discord_id).execute()
                title = '✅ อัปเดตข้อมูลสำเร็จ!'
            else:
                insert_data = {
                    'discord_id': self._discord_id,
                    'display_name': self._display_name,
                    'job_class': job_class,
                    'role': 'member'
                }
                supabase.table('profiles').insert(insert_data).execute()
                title = '🎉 ลงทะเบียนสำเร็จ!'

            embed = discord.Embed(title=title, color=discord.Color.green())
            embed.add_field(name='👤 ชื่อ', value=self._display_name, inline=True)
            embed.add_field(name=f'{JOB_EMOJIS.get(job_class,"⚔️")} อาชีพ', value=job_class, inline=True)
            embed.set_footer(text='ยินดีต้อนรับสู่ระบบประมูล!')

            self.disabled = True
            await interaction.response.edit_message(embed=embed, view=self.view)
        except Exception as e:
            await interaction.response.send_message(f'❌ เกิดข้อผิดพลาด: {e}', ephemeral=True)


class JobClassSelectView(discord.ui.View):
    def __init__(self, discord_id: str, display_name: str, is_update: bool):
        super().__init__(timeout=120)
        self.add_item(JobClassSelect(discord_id, display_name, is_update))


class EditProfileView(discord.ui.View):
    def __init__(self, profile: dict, discord_id: str):
        super().__init__(timeout=120)
        self._profile = profile
        self._discord_id = discord_id

    @discord.ui.button(label='✏️ แก้ไขข้อมูล', style=discord.ButtonStyle.primary)
    async def edit_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if str(interaction.user.id) != self._discord_id:
            await interaction.response.send_message('❌ คุณไม่มีสิทธิ์แก้ไขข้อมูลของคนอื่น', ephemeral=True)
            return
        modal = EditProfileModal(
            current_name=self._profile.get('display_name', ''),
            discord_id=self._discord_id
        )
        await interaction.response.send_modal(modal)


class MemberCog(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @app_commands.command(name='register', description='ลงทะเบียน / ดูข้อมูลของคุณในระบบ')
    @app_commands.describe(
        display_name='ชื่อตัวละครที่แสดงในระบบ',
    )
    async def register(
        self,
        interaction: discord.Interaction,
        display_name: str,
    ) -> None:
        await interaction.response.defer(ephemeral=True)
        discord_id = str(interaction.user.id)
        existing = await auction_service.get_profile_by_discord_id(discord_id)

        if existing:
            job = existing.get('job_class', 'ไม่ได้ระบุ') or 'ไม่ได้ระบุ'
            embed = discord.Embed(
                title='⚠️ คุณลงทะเบียนไว้แล้ว',
                description='ข้อมูลปัจจุบันของคุณในระบบ:',
                color=discord.Color.yellow()
            )
            embed.add_field(name='👤 ชื่อ', value=existing.get('display_name', '-'), inline=True)
            embed.add_field(name=f'{JOB_EMOJIS.get(job,"⚔️")} อาชีพ', value=job, inline=True)
            embed.set_footer(text='กดปุ่มด้านล่างหากต้องการแก้ไขข้อมูล')
            view = EditProfileView(existing, discord_id)
            await interaction.followup.send(embed=embed, view=view, ephemeral=True)
        else:
            embed = discord.Embed(
                title='🎭 เลือกอาชีพของคุณ',
                description=f'ยินดีต้อนรับ **{display_name}**! กรุณาเลือกอาชีพตัวละครของคุณ',
                color=discord.Color.blue()
            )
            view = JobClassSelectView(discord_id, display_name, is_update=False)
            await interaction.followup.send(embed=embed, view=view, ephemeral=True)

    @app_commands.command(name='credits', description='ดู carry credit ของตัวเองหรือสมาชิกคนอื่น')
    @app_commands.describe(member='สมาชิกที่ต้องการดู (ค่าเริ่มต้นคือตัวเอง)')
    async def credits(
        self,
        interaction: discord.Interaction,
        member: discord.Member | None = None,
    ) -> None:
        await interaction.response.defer(ephemeral=True)
        target = member or interaction.user
        profile = await auction_service.get_profile_by_discord_id(str(target.id))
        if not profile:
            name = member.display_name if member else 'คุณ'
            await interaction.followup.send(f'❌ {name} ยังไม่ได้ลงทะเบียนในระบบ', ephemeral=True)
            return
        credits_data = await credit_service.get_credits(profile['id'])
        ITEM_LABELS = {'Album': 'สมุดการ์ด', 'Puppet': 'เศษการ์ดบอส', 'White': 'ขนนกขาว', 'RedBlack': 'ขนนกดำแดง'}
        embed = discord.Embed(title=f'💳 Carry Credits — {profile["display_name"]}', color=discord.Color.gold())
        credits_map = {c['item_type']: c['credit'] for c in credits_data}
        for it, lbl in ITEM_LABELS.items():
            val = credits_map.get(it, 0)
            embed.add_field(name=lbl, value=f'**{val}** credits', inline=True)
        if not credits_data or all(c['credit'] == 0 for c in credits_data):
            embed.description = 'ยังไม่มี carry credit'
        embed.set_footer(text="Credit สะสมจากการเลือก 'Join the war / Do not want to bid'")
        await interaction.followup.send(embed=embed, ephemeral=True)

    @app_commands.command(name='mystatus', description='ดูโปรไฟล์และสถิติของตัวเอง')
    async def mystatus(self, interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)
        discord_id = str(interaction.user.id)
        profile = await auction_service.get_profile_by_discord_id(discord_id)
        if not profile:
            await interaction.followup.send('❌ คุณยังไม่ได้ลงทะเบียน ใช้คำสั่ง /register ก่อนนะครับ', ephemeral=True)
            return
        job = profile.get('job_class', 'ไม่ได้ระบุ') or 'ไม่ได้ระบุ'
        embed = discord.Embed(title=f'👤 โปรไฟล์ — {profile["display_name"]}', color=discord.Color.blurple())
        embed.add_field(name=f'{JOB_EMOJIS.get(job,"⚔️")} อาชีพ', value=job, inline=True)
        embed.add_field(name='🏷️ Role', value=profile.get('role', 'member'), inline=True)
        await interaction.followup.send(embed=embed, ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(MemberCog(bot))

from __future__ import annotations

import discord
from discord import app_commands
from discord.ext import commands

from services import auction_service, credit_service
from views.vote_view import item_label, ITEM_LABELS


class MemberCog(commands.Cog):
    """คำสั่ง slash สำหรับสมาชิกทั่วไป"""

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    # ─── /register ────────────────────────────────────────────────────────
    @app_commands.command(name="register", description="ลงทะเบียน / อัปเดตข้อมูลของคุณ")
    @app_commands.describe(
        display_name="ชื่อที่แสดงในระบบ",
        uid_game="UID ในเกม (ไม่บังคับ)",
    )
    async def register(
        self,
        interaction: discord.Interaction,
        display_name: str,
        uid_game: str | None = None,
    ) -> None:
        await interaction.response.defer(ephemeral=True)

        from services.supabase_client import supabase

        discord_id = str(interaction.user.id)
        existing = await auction_service.get_profile_by_discord_id(discord_id)

        try:
            if existing:
                # อัปเดตข้อมูล
                update_data: dict = {"display_name": display_name}
                if uid_game is not None:
                    update_data["uid_game"] = uid_game

                supabase.table("profiles").update(update_data).eq(
                    "discord_id", discord_id
                ).execute()

                embed = discord.Embed(
                    title="✅ อัปเดตข้อมูลสำเร็จ",
                    color=discord.Color.green(),
                )
                embed.add_field(name="ชื่อ", value=display_name, inline=True)
                if uid_game:
                    embed.add_field(name="UID Game", value=uid_game, inline=True)
                embed.set_footer(text="ข้อมูลของคุณถูกอัปเดตแล้ว")
            else:
                # สร้างใหม่
                insert_data: dict = {
                    "discord_id": discord_id,
                    "display_name": display_name,
                    "role": "member",
                }
                if uid_game is not None:
                    insert_data["uid_game"] = uid_game

                supabase.table("profiles").insert(insert_data).execute()

                embed = discord.Embed(
                    title="🎉 ลงทะเบียนสำเร็จ!",
                    color=discord.Color.green(),
                )
                embed.add_field(name="ชื่อ", value=display_name, inline=True)
                if uid_game:
                    embed.add_field(name="UID Game", value=uid_game, inline=True)
                embed.set_footer(text="ยินดีต้อนรับสู่ระบบประมูล!")

            await interaction.followup.send(embed=embed, ephemeral=True)

        except Exception as e:
            print(f"[MemberCog] register error: {e}")
            await interaction.followup.send(
                f"❌ เกิดข้อผิดพลาด: {e}", ephemeral=True
            )

    # ─── /credits ─────────────────────────────────────────────────────────
    @app_commands.command(
        name="credits", description="ดู carry credit ของตัวเองหรือสมาชิกคนอื่น"
    )
    @app_commands.describe(member="สมาชิกที่ต้องการดู (ค่าเริ่มต้นคือตัวเอง)")
    async def credits(
        self,
        interaction: discord.Interaction,
        member: discord.Member | None = None,
    ) -> None:
        await interaction.response.defer(ephemeral=True)

        target = member or interaction.user
        profile = await auction_service.get_profile_by_discord_id(str(target.id))

        if not profile:
            name = member.display_name if member else "คุณ"
            await interaction.followup.send(
                f"❌ {name} ยังไม่ได้ลงทะเบียนในระบบ", ephemeral=True
            )
            return

        credits_data = await credit_service.get_credits(profile["id"])

        embed = discord.Embed(
            title=f"💳 Carry Credits ของ {profile['display_name']}",
            color=discord.Color.gold(),
        )

        # แสดง credit ทุก item type
        all_item_types = list(ITEM_LABELS.keys())
        credits_map = {c["item_type"]: c["credit"] for c in credits_data}

        for it in all_item_types:
            credit_val = credits_map.get(it, 0)
            embed.add_field(
                name=item_label(it),
                value=f"**{credit_val}** credits",
                inline=True,
            )

        if not credits_data or all(c["credit"] == 0 for c in credits_data):
            embed.description = "ยังไม่มี carry credit"

        embed.set_footer(text="Credit สะสมจากการโหวต 'ไม่ประมูล'")
        await interaction.followup.send(embed=embed, ephemeral=True)

    # ─── /status ──────────────────────────────────────────────────────────
    @app_commands.command(name="status", description="ดูสถานะรอบประมูลปัจจุบัน")
    async def status(self, interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)

        round_data = await auction_service.get_active_round()

        if not round_data:
            await interaction.followup.send(
                "📭 ไม่มีรอบประมูลที่กำลังดำเนินอยู่ในขณะนี้", ephemeral=True
            )
            return

        summary = await auction_service.get_round_summary(round_data["id"])
        vote_counts = summary["vote_counts"]
        queues = summary["queues"]

        status_label = {
            "voting": "🗳️ กำลังโหวต",
            "bidding": "🎯 เปิดรับจองคิว",
            "closed": "🔒 ปิดแล้ว",
        }.get(round_data["status"], round_data["status"])

        embed = discord.Embed(
            title=f"📊 สถานะรอบประมูล — {item_label(round_data['item_type'])}",
            color=discord.Color.blue(),
        )
        embed.add_field(name="สถานะ", value=status_label, inline=True)
        embed.add_field(
            name="📦 ประเภทไอเทม",
            value=item_label(round_data["item_type"]),
            inline=True,
        )
        embed.add_field(
            name="🔢 จำนวน / ลิมิต",
            value=f"{round_data['total_quantity']} / {round_data['personal_limit']} ต่อคน",
            inline=True,
        )
        embed.add_field(
            name="📊 ผลโหวต",
            value=(
                f"✅ {vote_counts.get('want_bid', 0)} | "
                f"📦 {vote_counts.get('no_bid', 0)} | "
                f"❌ {vote_counts.get('absent', 0)}"
            ),
            inline=False,
        )

        if queues:
            waiting = [q for q in queues if q.get("status") == "waiting"]
            awarded = [q for q in queues if q.get("status") == "awarded"]
            embed.add_field(
                name="📋 คิว",
                value=f"รอ: {len(waiting)} | ได้รับแล้ว: {len(awarded)}",
                inline=True,
            )

        embed.set_footer(text=f"รอบวันที่ {round_data.get('round_date', '')}")
        await interaction.followup.send(embed=embed, ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(MemberCog(bot))

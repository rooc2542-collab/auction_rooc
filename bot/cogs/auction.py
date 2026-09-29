from __future__ import annotations

import discord
from discord import app_commands
from discord.ext import commands

from services import auction_service
from views.vote_view import item_label, ITEM_LABELS, build_vote_embed, VoteView
from views.result_view import build_result_embed, ResultView


# ─── Admin check helper ──────────────────────────────────────────────────────

async def check_admin(interaction: discord.Interaction) -> bool:
    """ตรวจสอบว่าผู้ใช้เป็น admin"""
    profile = await auction_service.get_profile_by_discord_id(str(interaction.user.id))
    if not profile or profile.get("role") != "admin":
        await interaction.response.send_message(
            "❌ คำสั่งนี้ใช้ได้เฉพาะ Admin เท่านั้น", ephemeral=True
        )
        return False
    return True


# ─── Item type choices ───────────────────────────────────────────────────────

ITEM_CHOICES = [
    app_commands.Choice(name="Album (สมุดการ์ด)", value="Album"),
    app_commands.Choice(name="Puppet (เศษการ์ดบอส)", value="Puppet"),
    app_commands.Choice(name="White (ขนนกขาว)", value="White"),
    app_commands.Choice(name="RedBlack (ขนนกดำแดง)", value="RedBlack"),
]


# ─── Cog ─────────────────────────────────────────────────────────────────────

class AuctionCog(commands.Cog):
    """คำสั่ง slash สำหรับ Admin จัดการรอบประมูล"""

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    # ─── /start_vote ──────────────────────────────────────────────────────
    @app_commands.command(
        name="start_vote", description="[Admin] เปิดรอบโหวตประมูลใหม่"
    )
    @app_commands.describe(
        item_type="ประเภทไอเทม",
        quantity="จำนวนไอเทมทั้งหมดในรอบนี้",
        limit="จำนวนสูงสุดที่แต่ละคนรับได้",
        channel="ช่องที่จะส่งข้อความโหวต",
    )
    @app_commands.choices(item_type=ITEM_CHOICES)
    async def start_vote(
        self,
        interaction: discord.Interaction,
        item_type: app_commands.Choice[str],
        quantity: int,
        limit: int,
        channel: discord.TextChannel,
    ) -> None:
        await interaction.response.defer(ephemeral=True)

        if not await check_admin(interaction):
            return

        # ตรวจสอบว่ามีรอบ active อยู่หรือยัง
        active = await auction_service.get_active_round()
        if active:
            await interaction.followup.send(
                f"❌ มีรอบที่กำลังดำเนินอยู่แล้ว (status: {active['status']}) "
                f"กรุณาปิดรอบเดิมก่อน",
                ephemeral=True,
            )
            return

        if quantity <= 0 or limit <= 0:
            await interaction.followup.send(
                "❌ จำนวนและลิมิตต้องมากกว่า 0", ephemeral=True
            )
            return

        # สร้างรอบในฐานข้อมูล
        round_data = await auction_service.create_round(
            item_type=item_type.value,
            total_qty=quantity,
            personal_limit=limit,
            channel_id=str(channel.id),
            created_by_discord_id=str(interaction.user.id),
        )

        if not round_data:
            await interaction.followup.send(
                "❌ ไม่สามารถสร้างรอบประมูลได้ กรุณาตรวจสอบ log", ephemeral=True
            )
            return

        # ส่ง VoteEmbed ไปยัง channel ที่กำหนด
        vote_embed = build_vote_embed(round_data)
        vote_view = VoteView()
        vote_msg = await channel.send(embed=vote_embed, view=vote_view)

        # บันทึก vote_message_id
        await auction_service.update_round_message_id(
            round_data["id"], str(vote_msg.id)
        )

        await interaction.followup.send(
            f"✅ โหวตเปิดแล้วที่ {channel.mention}", ephemeral=True
        )

    # ─── /close_vote ──────────────────────────────────────────────────────
    @app_commands.command(
        name="close_vote", description="[Admin] ปิดรอบโหวตและเปิดรับจองคิว"
    )
    async def close_vote(self, interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)

        if not await check_admin(interaction):
            return

        round_data = await auction_service.get_active_round()
        if not round_data:
            await interaction.followup.send(
                "❌ ไม่มีรอบที่กำลังดำเนินอยู่", ephemeral=True
            )
            return

        if round_data["status"] != "voting":
            await interaction.followup.send(
                f"❌ รอบปัจจุบันอยู่ในสถานะ '{round_data['status']}' ไม่สามารถปิดโหวตได้",
                ephemeral=True,
            )
            return

        # ปิดโหวต
        await auction_service.close_voting(round_data["id"])

        # พยายาม edit vote message เพื่อ disable ปุ่ม
        channel_id = round_data.get("channel_id")
        vote_message_id = round_data.get("vote_message_id")

        channel: discord.TextChannel | None = None
        if channel_id:
            channel = self.bot.get_channel(int(channel_id))  # type: ignore

        if channel and vote_message_id:
            try:
                vote_msg = await channel.fetch_message(int(vote_message_id))
                # สร้าง VoteView ที่ disabled ทุกปุ่ม
                disabled_view = VoteView()
                for item in disabled_view.children:
                    item.disabled = True  # type: ignore

                summary = await auction_service.get_round_summary(round_data["id"])
                closed_embed = build_vote_embed(
                    {**round_data, "status": "bidding"}, summary["vote_counts"]
                )
                closed_embed.title = f"🔒 ปิดการโหวตแล้ว | {item_label(round_data['item_type'])}"
                closed_embed.color = discord.Color.greyple()
                closed_embed.add_field(
                    name="สถานะ", value="ปิดโหวตแล้ว — เปิดรับจองคิว", inline=False
                )
                await vote_msg.edit(embed=closed_embed, view=disabled_view)
            except Exception as e:
                print(f"[AuctionCog] ไม่สามารถ edit vote message: {e}")

        # ส่ง ResultEmbed + ResultView ไปยัง channel เดิม
        summary = await auction_service.get_round_summary(round_data["id"])
        result_embed = build_result_embed(
            round_data, summary["vote_counts"], summary["queues"]
        )
        result_view = ResultView()

        if channel:
            result_msg = await channel.send(embed=result_embed, view=result_view)
            await auction_service.update_round_result_message_id(
                round_data["id"], str(result_msg.id)
            )

        await interaction.followup.send("🔒 ปิดโหวตเรียบร้อย เปิดรับจองคิวแล้ว", ephemeral=True)

    # ─── /award ───────────────────────────────────────────────────────────
    @app_commands.command(
        name="award", description="[Admin] มอบไอเทมให้สมาชิก"
    )
    @app_commands.describe(
        member="สมาชิกที่ต้องการ award",
        item_type="ประเภทไอเทม",
        note="หมายเหตุ (ไม่บังคับ)",
    )
    @app_commands.choices(item_type=ITEM_CHOICES)
    async def award(
        self,
        interaction: discord.Interaction,
        member: discord.Member,
        item_type: app_commands.Choice[str],
        note: str | None = None,
    ) -> None:
        await interaction.response.defer(ephemeral=True)

        if not await check_admin(interaction):
            return

        round_data = await auction_service.get_active_round()
        if not round_data:
            await interaction.followup.send(
                "❌ ไม่มีรอบที่กำลังดำเนินอยู่", ephemeral=True
            )
            return

        ok, msg = await auction_service.award_item(
            round_id=round_data["id"],
            discord_id=str(member.id),
            item_type=item_type.value,
            awarded_by_discord_id=str(interaction.user.id),
            note=note,
        )

        if ok:
            result_embed = discord.Embed(
                title="✅ Award สำเร็จ",
                color=discord.Color.green(),
            )
            result_embed.add_field(name="ผู้รับ", value=member.mention, inline=True)
            result_embed.add_field(
                name="ไอเทม", value=item_label(item_type.value), inline=True
            )
            if note:
                result_embed.add_field(name="หมายเหตุ", value=note, inline=False)

            await interaction.followup.send(embed=result_embed, ephemeral=True)

            # ประกาศใน channel ของรอบ
            channel_id = round_data.get("channel_id")
            if channel_id:
                channel: discord.TextChannel | None = self.bot.get_channel(int(channel_id))  # type: ignore
                if channel:
                    announce_embed = discord.Embed(
                        title="🏆 Award ประกาศ",
                        description=(
                            f"{member.mention} ได้รับ **{item_label(item_type.value)}** แล้ว! 🎉"
                        ),
                        color=discord.Color.gold(),
                    )
                    if note:
                        announce_embed.add_field(name="หมายเหตุ", value=note, inline=False)

                    await channel.send(embed=announce_embed)

                    # อัปเดต result embed ถ้ามี result_message_id
                    result_msg_id = round_data.get("result_message_id")
                    if result_msg_id:
                        try:
                            result_msg = await channel.fetch_message(int(result_msg_id))
                            summary = await auction_service.get_round_summary(round_data["id"])
                            from views.result_view import build_result_embed

                            updated_embed = build_result_embed(
                                round_data, summary["vote_counts"], summary["queues"]
                            )
                            await result_msg.edit(embed=updated_embed)
                        except Exception as e:
                            print(f"[AuctionCog] ไม่สามารถ update result message: {e}")
        else:
            await interaction.followup.send(f"❌ {msg}", ephemeral=True)

    # ─── /round_status ────────────────────────────────────────────────────
    @app_commands.command(
        name="round_status", description="[Admin] ดูสถานะรอบประมูลปัจจุบันแบบละเอียด"
    )
    async def round_status(self, interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)

        if not await check_admin(interaction):
            return

        round_data = await auction_service.get_active_round()
        if not round_data:
            await interaction.followup.send(
                "📭 ไม่มีรอบที่กำลังดำเนินอยู่", ephemeral=True
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
            title=f"📊 สถานะรอบ — {item_label(round_data['item_type'])}",
            color=discord.Color.purple(),
        )
        embed.add_field(name="สถานะ", value=status_label, inline=True)
        embed.add_field(
            name="📦 ประเภท", value=item_label(round_data["item_type"]), inline=True
        )
        embed.add_field(
            name="🔢 จำนวน / ลิมิต",
            value=f"{round_data['total_quantity']} / {round_data['personal_limit']} ต่อคน",
            inline=True,
        )
        embed.add_field(
            name="📊 ผลโหวต",
            value=(
                f"✅ ต้องการประมูล: **{vote_counts.get('want_bid', 0)}**\n"
                f"📦 ไม่ประมูล (carry): **{vote_counts.get('no_bid', 0)}**\n"
                f"❌ ไม่เข้าร่วม: **{vote_counts.get('absent', 0)}**"
            ),
            inline=False,
        )

        # แสดงคิวแบบละเอียด
        if queues:
            queue_lines = []
            for i, q in enumerate(queues, start=1):
                profile_info = q.get("profiles") or {}
                name = profile_info.get("display_name", "ไม่ทราบชื่อ")
                discord_id = profile_info.get("discord_id", "")
                credit = q.get("credit", 0)
                status_icon = {"waiting": "⏳", "awarded": "✅", "cancelled": "❌"}.get(
                    q.get("status", ""), "❓"
                )
                mention = f"<@{discord_id}>" if discord_id else name
                credit_str = f" | credit: {credit}" if credit > 0 else ""
                queue_lines.append(
                    f"{i}. {status_icon} **{name}** ({mention}){credit_str}"
                )

            embed.add_field(
                name=f"📋 คิวประมูล ({len(queues)} คน)",
                value="\n".join(queue_lines[:20]),  # จำกัด 20 บรรทัด
                inline=False,
            )
        else:
            embed.add_field(name="📋 คิว", value="ยังไม่มีผู้จองคิว", inline=False)

        embed.set_footer(
            text=f"รอบวันที่ {round_data.get('round_date', '')} | ID: {round_data['id'][:8]}..."
        )
        await interaction.followup.send(embed=embed, ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(AuctionCog(bot))

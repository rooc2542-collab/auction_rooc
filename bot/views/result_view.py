from __future__ import annotations

import discord
from services import auction_service
from views.vote_view import item_label


# ─── Embed Builder ───────────────────────────────────────────────────────────

def build_result_embed(
    round_data: dict,
    vote_counts: dict,
    queues: list,
) -> discord.Embed:
    """สร้าง embed แสดงผลโหวตและคิวประมูล"""
    label = item_label(round_data.get("item_type", ""))
    embed = discord.Embed(
        title=f"📋 ผลโหวตและคิวประมูล {label}",
        color=discord.Color.blurple(),
    )

    # ผลโหวต
    embed.add_field(
        name="📊 ผลการโหวต",
        value=(
            f"✅ ต้องการประมูล: **{vote_counts.get('want_bid', 0)}** คน\n"
            f"📦 ไม่ประมูล (carry): **{vote_counts.get('no_bid', 0)}** คน\n"
            f"❌ ไม่เข้าร่วม: **{vote_counts.get('absent', 0)}** คน"
        ),
        inline=False,
    )

    # คิว
    if queues:
        queue_lines = []
        for i, q in enumerate(queues, start=1):
            profile_info = q.get("profiles") or {}
            name = profile_info.get("display_name", "ไม่ทราบชื่อ")
            credit = q.get("credit", 0)
            status_icon = {"waiting": "⏳", "awarded": "✅", "cancelled": "❌"}.get(
                q.get("status", ""), "❓"
            )
            credit_str = f" (credit: {credit})" if credit > 0 else ""
            queue_lines.append(f"{i}. {status_icon} **{name}**{credit_str}")
        embed.add_field(
            name=f"📋 คิวประมูล ({len(queues)} คน)",
            value="\n".join(queue_lines) or "-",
            inline=False,
        )
    else:
        embed.add_field(name="📋 คิวประมูล", value="ยังไม่มีผู้จองคิว", inline=False)

    embed.add_field(
        name="📦 รายละเอียด",
        value=(
            f"ประเภท: **{label}** | "
            f"จำนวน: **{round_data.get('total_quantity', '-')}** | "
            f"ลิมิต/คน: **{round_data.get('personal_limit', '-')}**"
        ),
        inline=False,
    )

    embed.set_footer(text="กด 🎯 จองคิว เพื่อเข้าคิวประมูล")
    return embed


# ─── View ────────────────────────────────────────────────────────────────────

class ResultView(discord.ui.View):
    """View ปุ่มจองคิว persistent (timeout=None)"""

    def __init__(self) -> None:
        super().__init__(timeout=None)

    async def _get_round_from_message(
        self, interaction: discord.Interaction
    ) -> dict | None:
        """ดึง round จาก result_message_id"""
        from services.supabase_client import supabase

        result = (
            supabase.table("auction_rounds")
            .select("*")
            .eq("result_message_id", str(interaction.message.id))
            .execute()
        )
        if result.data:
            return result.data[0]
        return None

    async def _refresh_embed(
        self, message: discord.Message, round_data: dict
    ) -> None:
        """ดึงข้อมูลล่าสุดแล้ว edit embed"""
        summary = await auction_service.get_round_summary(round_data["id"])
        embed = build_result_embed(
            round_data, summary["vote_counts"], summary["queues"]
        )
        try:
            await message.edit(embed=embed)
        except Exception:
            pass

    # ─── ปุ่ม: 🎯 จองคิว ─────────────────────────────────────────────────
    @discord.ui.button(
        label="🎯 จองคิว",
        style=discord.ButtonStyle.primary,
        custom_id="queue_join",
    )
    async def queue_join(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ) -> None:
        # ตรวจสอบผู้ใช้ลงทะเบียนหรือยัง
        profile = await auction_service.get_profile_by_discord_id(
            str(interaction.user.id)
        )
        if not profile:
            await interaction.response.send_message(
                "❌ คุณยังไม่ได้ลงทะเบียน กรุณาใช้ `/register` ก่อน",
                ephemeral=True,
            )
            return

        # ดึงรอบจาก result_message_id
        round_data = await self._get_round_from_message(interaction)
        if not round_data:
            await interaction.response.send_message(
                "❌ ไม่พบรอบประมูลที่เชื่อมกับข้อความนี้", ephemeral=True
            )
            return

        if round_data["status"] != "bidding":
            await interaction.response.send_message(
                "❌ รอบนี้ไม่ได้เปิดรับการจองคิวในขณะนี้", ephemeral=True
            )
            return

        # ตรวจสอบการโหวต
        from services.supabase_client import supabase

        vote_check = (
            supabase.table("round_votes")
            .select("vote")
            .eq("round_id", round_data["id"])
            .eq("user_id", profile["id"])
            .execute()
        )
        if not vote_check.data or vote_check.data[0]["vote"] != "want_bid":
            await interaction.response.send_message(
                "❌ คุณต้องโหวต '✅ เข้าร่วม + ต้องการประมูล' ก่อนถึงจะจองคิวได้",
                ephemeral=True,
            )
            return

        # แสดง QueueModal
        from views.queue_modal import QueueModal

        modal = QueueModal(round_data=round_data, result_message=interaction.message)
        await interaction.response.send_modal(modal)

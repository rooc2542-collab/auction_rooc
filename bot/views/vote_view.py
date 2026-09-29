from __future__ import annotations

import discord
from services import auction_service

# ─── Label helper ────────────────────────────────────────────────────────────

ITEM_LABELS: dict[str, str] = {
    "Album": "สมุดการ์ด",
    "Puppet": "เศษการ์ดบอส",
    "White": "ขนนกขาว",
    "RedBlack": "ขนนกดำแดง",
}


def item_label(item_type: str) -> str:
    return ITEM_LABELS.get(item_type, item_type)


# ─── Embed Builder ───────────────────────────────────────────────────────────

def build_vote_embed(round_data: dict, vote_counts: dict | None = None) -> discord.Embed:
    """สร้าง embed สำหรับหน้าโหวต"""
    if vote_counts is None:
        vote_counts = {"want_bid": 0, "no_bid": 0, "absent": 0}

    label = item_label(round_data.get("item_type", ""))
    embed = discord.Embed(
        title=f"🎲 การโหวตรอบประมูล {label}",
        color=discord.Color.purple(),
    )
    embed.add_field(name="📦 ประเภทไอเทม", value=label, inline=True)
    embed.add_field(
        name="🔢 จำนวนทั้งหมด",
        value=str(round_data.get("total_quantity", "-")),
        inline=True,
    )
    embed.add_field(
        name="👤 ลิมิตต่อคน",
        value=str(round_data.get("personal_limit", "-")),
        inline=True,
    )
    embed.add_field(
        name="📊 สถิติโหวต",
        value=(
            f"✅ ต้องการประมูล: **{vote_counts.get('want_bid', 0)}** คน\n"
            f"📦 ไม่ประมูล (carry): **{vote_counts.get('no_bid', 0)}** คน\n"
            f"❌ ไม่เข้าร่วม: **{vote_counts.get('absent', 0)}** คน"
        ),
        inline=False,
    )
    embed.set_footer(text=f"รอบวันที่ {round_data.get('round_date', '')} | กดปุ่มด้านล่างเพื่อโหวต")
    return embed


# ─── View ────────────────────────────────────────────────────────────────────

class VoteView(discord.ui.View):
    """View ปุ่มโหวตที่ persistent (timeout=None)"""

    def __init__(self) -> None:
        super().__init__(timeout=None)

    # ── helper: refresh embed ──────────────────────────────────────────────
    async def _refresh_embed(self, message: discord.Message, round_data: dict) -> None:
        """ดึง vote counts ล่าสุดแล้ว edit embed"""
        summary = await auction_service.get_round_summary(round_data["id"])
        embed = build_vote_embed(round_data, summary["vote_counts"])
        try:
            await message.edit(embed=embed)
        except Exception:
            pass

    # ── helper: get round from message ────────────────────────────────────
    async def _get_round_from_message(
        self, interaction: discord.Interaction
    ) -> dict | None:
        """ดึง round จาก vote_message_id ที่ตรงกับ message นี้"""
        from services.supabase_client import supabase

        result = (
            supabase.table("auction_rounds")
            .select("*")
            .eq("vote_message_id", str(interaction.message.id))
            .execute()
        )
        if result.data:
            return result.data[0]
        return None

    # ── helper: check registered ──────────────────────────────────────────
    async def _require_profile(
        self, interaction: discord.Interaction
    ) -> dict | None:
        profile = await auction_service.get_profile_by_discord_id(
            str(interaction.user.id)
        )
        if not profile:
            await interaction.response.send_message(
                "❌ คุณยังไม่ได้ลงทะเบียน กรุณาใช้ `/register` ก่อน",
                ephemeral=True,
            )
            return None
        return profile

    # ─── ปุ่ม: ✅ เข้าร่วม + ต้องการประมูล ────────────────────────────────
    @discord.ui.button(
        label="✅ เข้าร่วม + ต้องการประมูล",
        style=discord.ButtonStyle.success,
        custom_id="vote_want_bid",
        row=0,
    )
    async def vote_want_bid(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ) -> None:
        await interaction.response.defer(ephemeral=True)

        profile = await self._require_profile(interaction)
        if not profile:
            return

        round_data = await self._get_round_from_message(interaction)
        if not round_data:
            await interaction.followup.send("❌ ไม่พบรอบประมูลที่เชื่อมกับข้อความนี้", ephemeral=True)
            return

        if round_data["status"] != "voting":
            await interaction.followup.send("❌ รอบโหวตนี้ปิดแล้ว", ephemeral=True)
            return

        ok, msg = await auction_service.save_vote(
            round_data["id"], str(interaction.user.id), "want_bid"
        )
        if ok:
            await interaction.followup.send(
                f"✅ บันทึกการโหวตของคุณ: **เข้าร่วม + ต้องการประมูล**",
                ephemeral=True,
            )
            await self._refresh_embed(interaction.message, round_data)
        else:
            await interaction.followup.send(f"❌ {msg}", ephemeral=True)

    # ─── ปุ่ม: 📦 เข้าร่วม + ไม่ประมูล ───────────────────────────────────
    @discord.ui.button(
        label="📦 เข้าร่วม + ไม่ประมูล",
        style=discord.ButtonStyle.secondary,
        custom_id="vote_no_bid",
        row=0,
    )
    async def vote_no_bid(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ) -> None:
        await interaction.response.defer(ephemeral=True)

        profile = await self._require_profile(interaction)
        if not profile:
            return

        round_data = await self._get_round_from_message(interaction)
        if not round_data:
            await interaction.followup.send("❌ ไม่พบรอบประมูลที่เชื่อมกับข้อความนี้", ephemeral=True)
            return

        if round_data["status"] != "voting":
            await interaction.followup.send("❌ รอบโหวตนี้ปิดแล้ว", ephemeral=True)
            return

        ok, msg = await auction_service.save_vote(
            round_data["id"], str(interaction.user.id), "no_bid"
        )
        if ok:
            await interaction.followup.send(
                f"📦 บันทึกการโหวตของคุณ: **เข้าร่วม + ไม่ประมูล** (ได้รับ carry credit)",
                ephemeral=True,
            )
            await self._refresh_embed(interaction.message, round_data)
        else:
            await interaction.followup.send(f"❌ {msg}", ephemeral=True)

    # ─── ปุ่ม: ❌ ไม่เข้าร่วม ─────────────────────────────────────────────
    @discord.ui.button(
        label="❌ ไม่เข้าร่วม",
        style=discord.ButtonStyle.danger,
        custom_id="vote_absent",
        row=0,
    )
    async def vote_absent(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ) -> None:
        await interaction.response.defer(ephemeral=True)

        profile = await self._require_profile(interaction)
        if not profile:
            return

        round_data = await self._get_round_from_message(interaction)
        if not round_data:
            await interaction.followup.send("❌ ไม่พบรอบประมูลที่เชื่อมกับข้อความนี้", ephemeral=True)
            return

        if round_data["status"] != "voting":
            await interaction.followup.send("❌ รอบโหวตนี้ปิดแล้ว", ephemeral=True)
            return

        ok, msg = await auction_service.save_vote(
            round_data["id"], str(interaction.user.id), "absent"
        )
        if ok:
            await interaction.followup.send(
                "❌ บันทึกการโหวตของคุณ: **ไม่เข้าร่วม**",
                ephemeral=True,
            )
            await self._refresh_embed(interaction.message, round_data)
        else:
            await interaction.followup.send(f"❌ {msg}", ephemeral=True)

    # ─── ปุ่ม: 🔒 ปิดโหวต [Admin] ────────────────────────────────────────
    @discord.ui.button(
        label="🔒 ปิดโหวต [Admin]",
        style=discord.ButtonStyle.primary,
        custom_id="vote_close",
        row=1,
    )
    async def vote_close(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ) -> None:
        await interaction.response.defer(ephemeral=True)

        # ตรวจสอบ admin
        profile = await auction_service.get_profile_by_discord_id(
            str(interaction.user.id)
        )
        if not profile or profile.get("role") != "admin":
            await interaction.followup.send("❌ เฉพาะ Admin เท่านั้น", ephemeral=True)
            return

        round_data = await self._get_round_from_message(interaction)
        if not round_data:
            await interaction.followup.send("❌ ไม่พบรอบประมูลที่เชื่อมกับข้อความนี้", ephemeral=True)
            return

        if round_data["status"] != "voting":
            await interaction.followup.send("❌ รอบนี้ไม่ได้อยู่ในสถานะ voting", ephemeral=True)
            return

        # ปิดโหวต
        await auction_service.close_voting(round_data["id"])

        # ปิดทุกปุ่มใน view นี้
        for item in self.children:
            item.disabled = True  # type: ignore

        summary = await auction_service.get_round_summary(round_data["id"])
        final_embed = build_vote_embed(
            {**round_data, "status": "bidding"}, summary["vote_counts"]
        )
        final_embed.title = f"🔒 ปิดการโหวตแล้ว | {item_label(round_data['item_type'])}"
        final_embed.color = discord.Color.greyple()
        final_embed.add_field(
            name="สถานะ", value="ปิดโหวตแล้ว — กำลังเปิดรับจองคิว", inline=False
        )

        await interaction.message.edit(embed=final_embed, view=self)

        # ส่ง ResultEmbed + ResultView ใน channel เดียวกัน
        from views.result_view import ResultView, build_result_embed

        result_embed = build_result_embed(
            round_data, summary["vote_counts"], summary["queues"]
        )
        result_view = ResultView()
        channel = interaction.channel
        result_msg = await channel.send(embed=result_embed, view=result_view)

        # บันทึก result_message_id
        await auction_service.update_round_result_message_id(
            round_data["id"], str(result_msg.id)
        )

        await interaction.followup.send("🔒 ปิดโหวตเรียบร้อย เปิดรับจองคิวแล้ว", ephemeral=True)

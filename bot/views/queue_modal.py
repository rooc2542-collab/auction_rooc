from __future__ import annotations

import discord
from services import auction_service
from views.vote_view import item_label


class QueueModal(discord.ui.Modal, title="จองคิวประมูล"):
    """Modal ยืนยันการจองคิว"""

    confirmation = discord.ui.TextInput(
        label="ยืนยันการจองคิว",
        placeholder="พิมพ์ 'ยืนยัน' เพื่อเข้าคิวประมูล",
        required=True,
        max_length=10,
    )

    def __init__(
        self,
        round_data: dict,
        result_message: discord.Message,
    ) -> None:
        super().__init__()
        self.round_data = round_data
        self.result_message = result_message

        item_type = round_data.get("item_type", "")
        label_text = item_label(item_type)
        # แสดงประเภทไอเทมใน label ของ TextInput
        self.confirmation.label = f"ยืนยันจองคิว: {label_text}"
        self.confirmation.placeholder = "พิมพ์ 'ยืนยัน' เพื่อเข้าคิว"

    async def on_submit(self, interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)

        # ตรวจสอบคำยืนยัน
        if self.confirmation.value.strip() != "ยืนยัน":
            await interaction.followup.send(
                "❌ กรุณาพิมพ์ 'ยืนยัน' เพื่อยืนยันการจองคิว",
                ephemeral=True,
            )
            return

        round_data = self.round_data
        round_id = round_data["id"]
        item_type = round_data.get("item_type", "")

        ok, msg = await auction_service.join_queue(
            round_id, str(interaction.user.id), item_type
        )

        if ok:
            await interaction.followup.send(
                f"🎉 {msg}\nคุณได้เข้าคิวประมูล **{item_label(item_type)}** แล้ว",
                ephemeral=True,
            )
            # อัปเดต embed ผลลัพธ์
            summary = await auction_service.get_round_summary(round_id)
            from views.result_view import build_result_embed

            new_embed = build_result_embed(
                round_data, summary["vote_counts"], summary["queues"]
            )
            try:
                await self.result_message.edit(embed=new_embed)
            except Exception as e:
                print(f"[QueueModal] ไม่สามารถ edit result message: {e}")
        else:
            await interaction.followup.send(f"❌ {msg}", ephemeral=True)

    async def on_error(
        self, interaction: discord.Interaction, error: Exception
    ) -> None:
        print(f"[QueueModal] on_error: {error}")
        try:
            await interaction.response.send_message(
                "❌ เกิดข้อผิดพลาดภายใน กรุณาลองใหม่", ephemeral=True
            )
        except Exception:
            pass

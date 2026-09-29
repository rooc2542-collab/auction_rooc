import asyncio
import os

import discord
from discord.ext import commands
from dotenv import load_dotenv

from views.vote_view import VoteView
from views.result_view import ResultView

load_dotenv()

TOKEN: str = os.environ.get("DISCORD_BOT_TOKEN", "")
GUILD_ID: int = int(os.environ.get("DISCORD_GUILD_ID", "0"))

if not TOKEN:
    raise ValueError("DISCORD_BOT_TOKEN ต้องตั้งค่าใน .env")
if not GUILD_ID:
    raise ValueError("DISCORD_GUILD_ID ต้องตั้งค่าใน .env")


class AuctionBot(commands.Bot):
    """Bot หลักสำหรับระบบประมูล"""

    def __init__(self) -> None:
        intents = discord.Intents.default()
        intents.members = True
        intents.message_content = True

        super().__init__(
            command_prefix="!",  # prefix สำรอง (ไม่ได้ใช้จริง ใช้ slash แทน)
            intents=intents,
            help_command=None,
        )

    async def setup_hook(self) -> None:
        """โหลด cogs และ register persistent views"""
        # โหลด cogs
        await self.load_extension("cogs.auction")
        await self.load_extension("cogs.member")

        # Register persistent views (สำคัญมาก: ต้องทำก่อน bot ready)
        # เพื่อให้ปุ่มยังคง active หลัง bot restart
        self.add_view(VoteView())
        self.add_view(ResultView())

        # Sync slash commands เฉพาะ guild นี้ (เร็วกว่า global sync)
        guild = discord.Object(id=GUILD_ID)
        self.tree.copy_global_to(guild=guild)
        synced = await self.tree.sync(guild=guild)
        print(f"[Bot] Synced {len(synced)} slash command(s) to guild {GUILD_ID}")

    async def on_ready(self) -> None:
        """เรียกเมื่อ bot พร้อมใช้งาน"""
        print(f"[Bot] Logged in as {self.user} (ID: {self.user.id})")  # type: ignore
        print(f"[Bot] Serving guild ID: {GUILD_ID}")
        print(f"[Bot] discord.py version: {discord.__version__}")
        await self.change_presence(
            activity=discord.Activity(
                type=discord.ActivityType.watching,
                name="ระบบประมูล RoOC 🎲",
            )
        )

    async def on_command_error(
        self, ctx: commands.Context, error: commands.CommandError
    ) -> None:
        """จัดการ error จาก prefix commands (สำรอง)"""
        print(f"[Bot] Command error: {error}")

    async def on_app_command_error(
        self,
        interaction: discord.Interaction,
        error: discord.app_commands.AppCommandError,
    ) -> None:
        """จัดการ error จาก slash commands"""
        print(f"[Bot] App command error: {error}")
        msg = "❌ เกิดข้อผิดพลาดภายใน กรุณาลองใหม่อีกครั้ง"
        try:
            if interaction.response.is_done():
                await interaction.followup.send(msg, ephemeral=True)
            else:
                await interaction.response.send_message(msg, ephemeral=True)
        except Exception:
            pass


async def main() -> None:
    bot = AuctionBot()
    async with bot:
        await bot.start(TOKEN)


if __name__ == "__main__":
    asyncio.run(main())

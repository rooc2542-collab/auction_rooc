import asyncio
import os
from aiohttp import web

import discord
from discord.ext import commands
from dotenv import load_dotenv

from views.vote_view import VoteView
from views.result_view import ResultView

load_dotenv()

TOKEN: str = os.environ.get("DISCORD_BOT_TOKEN", "")
GUILD_ID: int = int(os.environ.get("DISCORD_GUILD_ID", "0"))
PORT: int = int(os.environ.get("PORT", "8080"))  # Render inject PORT อัตโนมัติ

if not TOKEN:
    raise ValueError("DISCORD_BOT_TOKEN ต้องตั้งค่าใน .env")
if not GUILD_ID:
    raise ValueError("DISCORD_GUILD_ID ต้องตั้งค่าใน .env")


# ─── Health Check HTTP Server ────────────────────────────────────────────────

async def health_handler(request: web.Request) -> web.Response:
    """Health endpoint สำหรับ Render keep-alive + UptimeRobot ping"""
    return web.Response(text="✅ Auction Bot is running!", status=200)


async def start_http_server() -> None:
    """รัน HTTP server เล็กๆ ไว้รับ ping จาก UptimeRobot"""
    app = web.Application()
    app.router.add_get("/", health_handler)
    app.router.add_get("/health", health_handler)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", PORT)
    await site.start()
    print(f"[Health] HTTP server running on port {PORT}")


# ─── Bot ─────────────────────────────────────────────────────────────────────

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
        await self.load_extension("cogs.auction")
        await self.load_extension("cogs.member")

        # Register persistent views เพื่อให้ปุ่มยังคง active หลัง bot restart
        self.add_view(VoteView())
        self.add_view(ResultView())

        # Register attendance views for recent events (last 7 days)
        from services.supabase_client import supabase
        from views.attendance_view import EventPollView
        from datetime import date, timedelta
        try:
            week_ago = str(date.today() - timedelta(days=7))
            res = supabase.table('event_attendance').select('event_name, event_date').gte('event_date', week_ago).execute()
            seen = set()
            for row in (res.data or []):
                key = (row['event_name'], row['event_date'])
                if key not in seen:
                    seen.add(key)
                    self.add_view(EventPollView(row['event_name'], row['event_date']))
        except Exception as e:
            print(f'[Bot] Could not register attendance views: {e}')

        # Sync slash commands เฉพาะ guild นี้
        guild = discord.Object(id=GUILD_ID)
        self.tree.copy_global_to(guild=guild)
        synced = await self.tree.sync(guild=guild)
        print(f"[Bot] Synced {len(synced)} slash command(s) to guild {GUILD_ID}")

    async def on_ready(self) -> None:
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
        print(f"[Bot] Command error: {error}")

    async def on_app_command_error(
        self,
        interaction: discord.Interaction,
        error: discord.app_commands.AppCommandError,
    ) -> None:
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
    # รัน HTTP server และ bot พร้อมกัน
    await start_http_server()
    bot = AuctionBot()
    async with bot:
        await bot.start(TOKEN)


if __name__ == "__main__":
    asyncio.run(main())

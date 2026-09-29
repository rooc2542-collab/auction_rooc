# Auction RoOC — Bot

## Setup

```bash
cd bot
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# แก้ไข .env ใส่ค่าจริง
python main.py
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DISCORD_BOT_TOKEN` | Bot Token จาก Discord Developer Portal |
| `DISCORD_GUILD_ID` | Server ID ของ Discord Guild |
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SERVICE_KEY` | Supabase Service Role Key |

## Commands

### Admin Commands
| Command | Description |
|---------|-------------|
| `/start_vote` | เปิดโหวต round ใหม่ |
| `/close_vote` | ปิดโหวตและเริ่ม phase จองคิว |
| `/award @user item_type` | บันทึกว่า user ได้รับไอเทม |
| `/round_status` | ดูสถานะ round ปัจจุบัน |

### Member Commands
| Command | Description |
|---------|-------------|
| `/register display_name` | ลงทะเบียนเข้าระบบ |
| `/credits [@user]` | ดูยอดค้างสะสม |
| `/status` | ดูสถานะ round ปัจจุบัน |

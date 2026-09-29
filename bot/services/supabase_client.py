import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY: str = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL และ SUPABASE_SERVICE_KEY ต้องตั้งค่าใน .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

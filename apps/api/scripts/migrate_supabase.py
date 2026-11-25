"""
Automatic Supabase Database Migration Script.
Connects via DATABASE_URL and executes supabase_schema.sql.
"""

import asyncio
import os
from pathlib import Path
import asyncpg
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if not (ROOT_DIR / "supabase_schema.sql").exists():
    ROOT_DIR = Path(__file__).resolve().parents[3]

load_dotenv(ROOT_DIR / ".env")
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
SCHEMA_FILE = ROOT_DIR / "supabase_schema.sql"


async def run_migration():
    if not DATABASE_URL:
        print("❌ Error: DATABASE_URL not found in .env file.")
        return False

    print(f"Connecting to database...")
    try:
        # statement_cache_size=0 is required for Supabase transaction pooler (port 6543)
        conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0, ssl="require", timeout=15)
        print("Connected successfully!")
        
        print(f"Reading schema from {SCHEMA_FILE}...")
        sql = SCHEMA_FILE.read_text(encoding="utf-8")

        print("Executing migration...")
        await conn.execute(sql)
        print("Migration applied successfully!")

        tables = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """)
        table_names = [r["table_name"] for r in tables]
        print(f"Verified tables in public schema: {', '.join(table_names)}")

        await conn.close()
        return True
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False


if __name__ == "__main__":
    asyncio.run(run_migration())

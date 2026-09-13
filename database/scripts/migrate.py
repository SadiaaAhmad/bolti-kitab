#!/usr/bin/env python3
"""
Bolti Kitab (بولتی کتاب)
Initial Phase 1 PostgreSQL schema/migration baseline runner.

Usage:
  python database/scripts/migrate.py --status
  python database/scripts/migrate.py --dry-run
  python database/scripts/migrate.py --up
  python database/scripts/migrate.py --down

Configuration:
  Reads connection settings from DATABASE_URL or individual DB_* environment variables.
  Credentials are never hardcoded in this script.
"""

import os
import sys
import argparse
import psycopg2
from pathlib import Path

# Optional: Load .env file from project root if present
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if env_path.exists():
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))

DATABASE_URL = os.getenv("DATABASE_URL")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "bolti_kitab_dev")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASSWORD", "")

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"

def get_connection():
    if DATABASE_URL:
        return psycopg2.connect(DATABASE_URL)
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS
    )

def ensure_migration_table(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(255) PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    """)

def get_applied_migrations(cur):
    ensure_migration_table(cur)
    cur.execute("SELECT version FROM schema_migrations ORDER BY version ASC;")
    return [row[0] for row in cur.fetchall()]

def show_status():
    conn = get_connection()
    cur = conn.cursor()
    try:
        applied = get_applied_migrations(cur)
        available = sorted([f.name for f in MIGRATIONS_DIR.glob("*.sql") if not f.name.endswith(".down.sql")])
        target_info = DATABASE_URL.split("@")[-1] if DATABASE_URL else f"{DB_NAME}@{DB_HOST}:{DB_PORT}"
        print(f"\n--- Bolti Kitab Database Migration Status [{target_info}] ---")
        for m in available:
            status = "APPLIED" if m in applied else "PENDING"
            print(f"  [{status}] {m}")
        print()
    finally:
        cur.close()
        conn.close()

def dry_run():
    target_info = DATABASE_URL.split("@")[-1] if DATABASE_URL else f"{DB_NAME}@{DB_HOST}:{DB_PORT}"
    print(f"\n[DRY RUN] Validating migrations against {target_info} without committing...")
    conn = get_connection()
    cur = conn.cursor()
    try:
        migration_files = sorted([f for f in MIGRATIONS_DIR.glob("*.sql") if not f.name.endswith(".down.sql")])
        for mf in migration_files:
            print(f"  Validating {mf.name}...")
            sql = mf.read_text(encoding="utf-8")
            cur.execute(sql)
            print(f"  [OK] {mf.name} parsed and verified successfully.")
        print("[SUCCESS] All migrations passed syntax and constraint validation. Rolling back transaction.")
    except Exception as e:
        print(f"[ERROR] Migration failed validation: {e}")
        sys.exit(1)
    finally:
        conn.rollback()
        cur.close()
        conn.close()

def run_up():
    target_info = DATABASE_URL.split("@")[-1] if DATABASE_URL else f"{DB_NAME}@{DB_HOST}:{DB_PORT}"
    print(f"\nApplying pending migrations to {target_info}...")
    conn = get_connection()
    cur = conn.cursor()
    try:
        applied = get_applied_migrations(cur)
        migration_files = sorted([f for f in MIGRATIONS_DIR.glob("*.sql") if not f.name.endswith(".down.sql")])
        count = 0
        for mf in migration_files:
            if mf.name not in applied:
                print(f"  Applying {mf.name}...")
                sql = mf.read_text(encoding="utf-8")
                cur.execute(sql)
                cur.execute("INSERT INTO schema_migrations (version) VALUES (%s);", (mf.name,))
                conn.commit()
                print(f"  [SUCCESS] {mf.name} applied.")
                count += 1
            else:
                print(f"  [SKIPPED] {mf.name} already applied.")
        print(f"\nMigration complete. {count} new migration(s) applied.\n")
    except Exception as e:
        conn.rollback()
        print(f"[ERROR] Migration execution aborted: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()

def run_down():
    target_info = DATABASE_URL.split("@")[-1] if DATABASE_URL else f"{DB_NAME}@{DB_HOST}:{DB_PORT}"
    print(f"\nRolling back latest migration from {target_info}...")
    conn = get_connection()
    cur = conn.cursor()
    try:
        applied = get_applied_migrations(cur)
        if not applied:
            print("No migrations to roll back.")
            return
        latest = applied[-1]
        down_file = MIGRATIONS_DIR / latest.replace(".sql", ".down.sql")
        if not down_file.exists():
            print(f"[ERROR] Down migration file not found: {down_file.name}")
            sys.exit(1)
        print(f"  Executing rollback: {down_file.name}...")
        sql = down_file.read_text(encoding="utf-8")
        cur.execute(sql)
        cur.execute("DELETE FROM schema_migrations WHERE version = %s;", (latest,))
        conn.commit()
        print(f"  [SUCCESS] Rolled back {latest}.\n")
    except Exception as e:
        conn.rollback()
        print(f"[ERROR] Rollback failed: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bolti Kitab Migration Runner")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--status", action="store_true", help="Show migration status")
    group.add_argument("--dry-run", action="store_true", help="Validate SQL syntax in an uncommitted transaction")
    group.add_argument("--up", action="store_true", help="Apply pending migrations")
    group.add_argument("--down", action="store_true", help="Roll back the latest migration")
    args = parser.parse_args()

    if args.status:
        show_status()
    elif args.dry_run:
        dry_run()
    elif args.up:
        run_up()
    elif args.down:
        run_down()

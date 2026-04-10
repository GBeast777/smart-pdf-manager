"""
Migration script: Fixes the SQLite database schema to match the current models.
Run this ONCE after stopping the backend server.
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "smartpdfmanager.db")

def migrate():
    if not os.path.exists(DB_PATH):
        print("No existing DB found. A fresh one will be created on next server start.")
        return

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Get current columns in documents table
    existing_cols = [row[1] for row in cur.execute("PRAGMA table_info(documents)").fetchall()]
    print(f"Existing columns: {existing_cols}")

    # Add 'tags' column if missing (maps to old 'category')
    if 'tags' not in existing_cols:
        cur.execute("ALTER TABLE documents ADD COLUMN tags TEXT")
        print("Added 'tags' column")

        # Copy old 'category' data into 'tags' if category exists
        if 'category' in existing_cols:
            cur.execute("UPDATE documents SET tags = category")
            print("Copied 'category' values into 'tags'")

    # Add 'file_size' column if missing
    if 'file_size' not in existing_cols:
        cur.execute("ALTER TABLE documents ADD COLUMN file_size INTEGER")
        print("Added 'file_size' column")

    conn.commit()
    conn.close()

    # Verify
    conn = sqlite3.connect(DB_PATH)
    final_cols = [row[1] for row in conn.execute("PRAGMA table_info(documents)").fetchall()]
    conn.close()
    print(f"Final columns: {final_cols}")
    print("Migration complete!")

if __name__ == "__main__":
    migrate()

import os, sys
sys.path.insert(0, '.')
from db.database import engine, SQLALCHEMY_DATABASE_URL

print('Engine URL:', SQLALCHEMY_DATABASE_URL)

import sqlite3
db_path = SQLALCHEMY_DATABASE_URL.replace('sqlite:///', '')
print('DB Path:', db_path)
print('DB exists:', os.path.exists(db_path))

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    print('Tables:', tables)
    for t in tables:
        cols = conn.execute(f"PRAGMA table_info({t[0]})").fetchall()
        print(f'  {t[0]} columns:', [c[1] for c in cols])
    conn.close()
else:
    print('DB file does NOT exist - will be created fresh by create_all')
    from db.database import Base
    from db import models
    Base.metadata.create_all(bind=engine)
    print('Tables created!')
    conn = sqlite3.connect(db_path)
    tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    print('Tables now:', tables)
    for t in tables:
        cols = conn.execute(f"PRAGMA table_info({t[0]})").fetchall()
        print(f'  {t[0]} columns:', [c[1] for c in cols])
    conn.close()

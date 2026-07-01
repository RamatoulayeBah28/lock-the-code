import psycopg2
from config import get_settings

def get_db():
    conn = psycopg2.connect(get_settings().database_url)
    try:
        yield conn
    finally:
        conn.close()

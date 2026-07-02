from psycopg2 import pool
from config import get_settings

_pool: pool.ThreadedConnectionPool | None = None

def _get_pool() -> pool.ThreadedConnectionPool:
    global _pool
    if _pool is None:
        _pool = pool.ThreadedConnectionPool(1, 10, get_settings().database_url)
    return _pool

def get_db():
    conn = _get_pool().getconn()
    try:
        yield conn
    finally:
        _get_pool().putconn(conn)

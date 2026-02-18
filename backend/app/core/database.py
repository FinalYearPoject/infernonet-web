import psycopg2
from psycopg2 import pool

from app.core.config import Config

_connection_pool = None


def get_pool():
    global _connection_pool
    if _connection_pool is None:
        _connection_pool = psycopg2.pool.SimpleConnectionPool(
            1,
            20,
            host=Config.DB_HOST,
            port=Config.DB_PORT,
            database=Config.DB_NAME,
            user=Config.DB_USER,
            password=Config.DB_PASSWORD,
        )
    return _connection_pool


def get_connection():
    return get_pool().getconn()


def return_connection(conn):
    get_pool().putconn(conn)

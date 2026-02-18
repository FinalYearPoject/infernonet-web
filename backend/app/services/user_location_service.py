from app.core.database import get_connection, return_connection
from psycopg2.extras import RealDictCursor


def list_user_locations(user_id: str | None = None, limit: int = 500) -> list[dict]:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        if user_id:
            cur.execute(
                "SELECT id, user_id, latitude, longitude, updated_at FROM user_locations WHERE user_id = %s",
                (user_id,),
            )
        else:
            cur.execute(
                "SELECT id, user_id, latitude, longitude, updated_at FROM user_locations ORDER BY updated_at DESC LIMIT %s",
                (limit,),
            )
        return [dict(r) for r in cur.fetchall()]
    finally:
        if conn:
            return_connection(conn)


def upsert_user_location(user_id: str, latitude: float, longitude: float) -> dict:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """INSERT INTO user_locations (user_id, latitude, longitude)
               VALUES (%s, %s, %s)
               ON CONFLICT (user_id) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, updated_at = CURRENT_TIMESTAMP
               RETURNING id, user_id, latitude, longitude, updated_at""",
            (user_id, latitude, longitude),
        )
        row = cur.fetchone()
        conn.commit()
        return dict(row)
    finally:
        if conn:
            return_connection(conn)


def get_user_location(user_id: str) -> dict | None:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            "SELECT id, user_id, latitude, longitude, updated_at FROM user_locations WHERE user_id = %s",
            (user_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        if conn:
            return_connection(conn)

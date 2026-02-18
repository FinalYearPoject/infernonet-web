from app.core.database import get_connection, return_connection
from psycopg2.extras import RealDictCursor


def list_channels(incident_id: str | None = None, team_id: str | None = None, limit: int = 100) -> list[dict]:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        conditions = []
        params = []
        if incident_id:
            conditions.append("incident_id = %s")
            params.append(incident_id)
        if team_id:
            conditions.append("team_id = %s")
            params.append(team_id)
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        params.append(limit)
        cur.execute(
            f"""SELECT id, name, incident_id, team_id, is_public, created_by, created_at, updated_at FROM channels {where} ORDER BY created_at DESC LIMIT %s""",
            params,
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        if conn:
            return_connection(conn)


def get_channel_by_id(channel_id: str) -> dict | None:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            "SELECT id, name, incident_id, team_id, is_public, created_by, created_at, updated_at FROM channels WHERE id = %s",
            (channel_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        if conn:
            return_connection(conn)


def create_channel(
    name: str,
    incident_id: str | None = None,
    team_id: str | None = None,
    is_public: bool = False,
    created_by: str | None = None,
) -> dict:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """INSERT INTO channels (name, incident_id, team_id, is_public, created_by)
               VALUES (%s, %s, %s, %s, %s)
               RETURNING id, name, incident_id, team_id, is_public, created_by, created_at, updated_at""",
            (name, incident_id, team_id, is_public, created_by),
        )
        row = cur.fetchone()
        conn.commit()
        return dict(row)
    finally:
        if conn:
            return_connection(conn)


def add_channel_member(channel_id: str, user_id: str) -> None:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO channel_members (channel_id, user_id) VALUES (%s, %s) ON CONFLICT (channel_id, user_id) DO NOTHING",
            (channel_id, user_id),
        )
        conn.commit()
    finally:
        if conn:
            return_connection(conn)


def list_messages(channel_id: str, limit: int = 100, offset: int = 0) -> list[dict]:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """SELECT id, channel_id, user_id, content, created_at, edited_at
               FROM messages WHERE channel_id = %s ORDER BY created_at DESC LIMIT %s OFFSET %s""",
            (channel_id, limit, offset),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        if conn:
            return_connection(conn)


def create_message(channel_id: str, content: str, user_id: str | None = None) -> dict:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """INSERT INTO messages (channel_id, user_id, content)
               VALUES (%s, %s, %s)
               RETURNING id, channel_id, user_id, content, created_at, edited_at""",
            (channel_id, user_id, content),
        )
        row = cur.fetchone()
        conn.commit()
        return dict(row)
    finally:
        if conn:
            return_connection(conn)


def get_message_by_id(message_id: str) -> dict | None:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            "SELECT id, channel_id, user_id, content, created_at, edited_at FROM messages WHERE id = %s",
            (message_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        if conn:
            return_connection(conn)

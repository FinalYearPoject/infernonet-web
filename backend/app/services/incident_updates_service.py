from app.core.database import get_connection, return_connection
from psycopg2.extras import RealDictCursor


def list_incident_updates(incident_id: str, limit: int = 100) -> list[dict]:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """SELECT id, incident_id, user_id, content, status_before, status_after, created_at
               FROM incident_updates WHERE incident_id = %s ORDER BY created_at DESC LIMIT %s""",
            (incident_id, limit),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        if conn:
            return_connection(conn)


def create_incident_update(
    incident_id: str,
    content: str,
    user_id: str | None = None,
    status_before: str | None = None,
    status_after: str | None = None,
) -> dict:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """INSERT INTO incident_updates (incident_id, user_id, content, status_before, status_after)
               VALUES (%s, %s, %s, %s, %s)
               RETURNING id, incident_id, user_id, content, status_before, status_after, created_at""",
            (incident_id, user_id, content, status_before, status_after),
        )
        row = cur.fetchone()
        conn.commit()
        return dict(row)
    finally:
        if conn:
            return_connection(conn)

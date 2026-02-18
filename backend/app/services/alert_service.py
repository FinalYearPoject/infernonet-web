from app.core.database import get_connection, return_connection
from psycopg2.extras import RealDictCursor


def list_alerts(incident_id: str | None = None, limit: int = 100) -> list[dict]:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        if incident_id:
            cur.execute(
                """SELECT id, incident_id, title, message, severity, created_by, created_at, expires_at
                   FROM alerts WHERE incident_id = %s ORDER BY created_at DESC LIMIT %s""",
                (incident_id, limit),
            )
        else:
            cur.execute(
                """SELECT id, incident_id, title, message, severity, created_by, created_at, expires_at
                   FROM alerts ORDER BY created_at DESC LIMIT %s""",
                (limit,),
            )
        return [dict(r) for r in cur.fetchall()]
    finally:
        if conn:
            return_connection(conn)


def get_alert_by_id(alert_id: str) -> dict | None:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            "SELECT id, incident_id, title, message, severity, created_by, created_at, expires_at FROM alerts WHERE id = %s",
            (alert_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        if conn:
            return_connection(conn)


def create_alert(
    title: str,
    message: str,
    incident_id: str | None = None,
    severity: str = "info",
    created_by: str | None = None,
    expires_at: str | None = None,
) -> dict:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """INSERT INTO alerts (incident_id, title, message, severity, created_by, expires_at)
               VALUES (%s, %s, %s, %s, %s, %s)
               RETURNING id, incident_id, title, message, severity, created_by, created_at, expires_at""",
            (incident_id, title, message, severity, created_by, expires_at),
        )
        row = cur.fetchone()
        conn.commit()
        return dict(row)
    finally:
        if conn:
            return_connection(conn)

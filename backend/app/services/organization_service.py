from app.core.database import get_connection, return_connection
from psycopg2.extras import RealDictCursor


def list_organizations(limit: int = 100) -> list[dict]:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            "SELECT id, name, type, contact_phone, address, created_at, updated_at FROM organizations ORDER BY name LIMIT %s",
            (limit,),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        if conn:
            return_connection(conn)


def get_organization_by_id(org_id: str) -> dict | None:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            "SELECT id, name, type, contact_phone, address, created_at, updated_at FROM organizations WHERE id = %s",
            (org_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        if conn:
            return_connection(conn)


def create_organization(name: str, type: str, contact_phone: str | None = None, address: str | None = None) -> dict:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """INSERT INTO organizations (name, type, contact_phone, address)
               VALUES (%s, %s, %s, %s)
               RETURNING id, name, type, contact_phone, address, created_at, updated_at""",
            (name, type, contact_phone, address),
        )
        row = cur.fetchone()
        conn.commit()
        return dict(row)
    finally:
        if conn:
            return_connection(conn)

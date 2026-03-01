from app.core.database import get_connection, return_connection
from app.core.security import hash_password
from psycopg2.extras import RealDictCursor


def list_users(role: str | None = None, organization_id: str | None = None, limit: int = 100) -> list[dict]:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        conditions = []
        params = []
        if role:
            conditions.append("role = %s")
            params.append(role)
        if organization_id:
            conditions.append("organization_id = %s")
            params.append(organization_id)
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        params.append(limit)
        cur.execute(
            f"""SELECT id, email, full_name, role, phone, organization_id, avatar_url, is_active, created_at, updated_at
                FROM users {where} ORDER BY created_at DESC LIMIT %s""",
            params,
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        if conn:
            return_connection(conn)


def get_user_by_id(user_id: str) -> dict | None:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """SELECT id, email, full_name, role, phone, organization_id, avatar_url, is_active, created_at, updated_at
               FROM users WHERE id = %s""",
            (user_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        if conn:
            return_connection(conn)


def get_user_by_email(email: str) -> dict | None:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT id, email, password_hash, full_name, role FROM users WHERE email = %s", (email,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        if conn:
            return_connection(conn)


def create_user(
    email: str,
    password: str,
    full_name: str,
    role: str,
    phone: str | None = None,
    organization_id: str | None = None,
    avatar_url: str | None = None,
) -> dict:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        password_hash = hash_password(password)
        cur.execute(
            """INSERT INTO users (email, password_hash, full_name, role, phone, organization_id, avatar_url)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               RETURNING id, email, full_name, role, phone, organization_id, avatar_url, is_active, created_at, updated_at""",
            (email, password_hash, full_name, role, phone, organization_id, avatar_url),
        )
        row = cur.fetchone()
        conn.commit()
        return dict(row)
    finally:
        if conn:
            return_connection(conn)


def update_user(user_id: str, data: dict) -> dict | None:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        allowed = {"full_name", "role", "phone", "organization_id", "avatar_url", "is_active"}
        updates = []
        params = []
        for key, val in data.items():
            if key in allowed:
                updates.append(f"{key} = %s")
                params.append(str(val) if key == "organization_id" and val is not None else val)
        if not updates:
            return get_user_by_id(user_id)
        params.append(user_id)
        cur.execute(
            f"""UPDATE users SET {", ".join(updates)} WHERE id = %s
                RETURNING id, email, full_name, role, phone, organization_id, avatar_url, is_active, created_at, updated_at""",
            params,
        )
        row = cur.fetchone()
        conn.commit()
        return dict(row) if row else None
    finally:
        if conn:
            return_connection(conn)


def delete_user(user_id: str) -> bool:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        if conn:
            return_connection(conn)

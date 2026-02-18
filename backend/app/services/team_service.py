from app.core.database import get_connection, return_connection
from psycopg2.extras import RealDictCursor


def list_teams(organization_id: str | None = None, incident_id: str | None = None, limit: int = 100) -> list[dict]:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        conditions = []
        params = []
        if organization_id:
            conditions.append("organization_id = %s")
            params.append(organization_id)
        if incident_id:
            conditions.append("incident_id = %s")
            params.append(incident_id)
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        params.append(limit)
        cur.execute(
            f"""SELECT id, name, organization_id, incident_id, created_at, updated_at FROM teams {where} ORDER BY name LIMIT %s""",
            params,
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        if conn:
            return_connection(conn)


def get_team_by_id(team_id: str) -> dict | None:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            "SELECT id, name, organization_id, incident_id, created_at, updated_at FROM teams WHERE id = %s",
            (team_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        if conn:
            return_connection(conn)


def create_team(name: str, organization_id: str, incident_id: str | None = None) -> dict:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """INSERT INTO teams (name, organization_id, incident_id)
               VALUES (%s, %s, %s)
               RETURNING id, name, organization_id, incident_id, created_at, updated_at""",
            (name, organization_id, incident_id),
        )
        row = cur.fetchone()
        conn.commit()
        return dict(row)
    finally:
        if conn:
            return_connection(conn)


def update_team(team_id: str, *, name: str | None = None, incident_id: str | None = None) -> dict | None:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        updates = []
        params = []
        if name is not None:
            updates.append("name = %s")
            params.append(name)
        if incident_id is not None:
            updates.append("incident_id = %s")
            params.append(incident_id)
        if not updates:
            return get_team_by_id(team_id)
        params.append(team_id)
        cur.execute(
            f"UPDATE teams SET {', '.join(updates)} WHERE id = %s RETURNING id, name, organization_id, incident_id, created_at, updated_at",
            params,
        )
        row = cur.fetchone()
        conn.commit()
        return dict(row) if row else None
    finally:
        if conn:
            return_connection(conn)


def add_team_member(team_id: str, user_id: str, role_in_team: str = "member") -> dict:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """INSERT INTO team_members (team_id, user_id, role_in_team)
               VALUES (%s, %s, %s)
               ON CONFLICT (team_id, user_id) DO UPDATE SET role_in_team = EXCLUDED.role_in_team
               RETURNING id, team_id, user_id, role_in_team, joined_at""",
            (team_id, user_id, role_in_team),
        )
        row = cur.fetchone()
        conn.commit()
        return dict(row)
    finally:
        if conn:
            return_connection(conn)


def remove_team_member(team_id: str, user_id: str) -> bool:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM team_members WHERE team_id = %s AND user_id = %s", (team_id, user_id))
        conn.commit()
        return cur.rowcount > 0
    finally:
        if conn:
            return_connection(conn)


def list_team_members(team_id: str) -> list[dict]:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            "SELECT id, team_id, user_id, role_in_team, joined_at FROM team_members WHERE team_id = %s ORDER BY joined_at",
            (team_id,),
        )
        return [dict(r) for r in cur.fetchall()]
    finally:
        if conn:
            return_connection(conn)

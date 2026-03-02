from app.core.database import get_connection, return_connection
from psycopg2.extras import RealDictCursor


def create_incident(
    title: str,
    latitude: float,
    longitude: float,
    description: str | None = None,
    severity: str = "medium",
    address: str | None = None,
    created_by: str | None = None,
    created_by_role: str | None = None,
) -> dict:
    status = "pending" if created_by_role == "civilian" else "reported"
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """INSERT INTO incidents (title, description, status, severity, latitude, longitude, address, created_by)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id, title, description, status, severity, latitude, longitude, address,
                         reported_at, created_by, resolved_at, created_at, updated_at""",
            (title, description, status, severity, latitude, longitude, address, created_by),
        )
        row = cur.fetchone()
        conn.commit()
        return dict(row)
    finally:
        if conn:
            return_connection(conn)


def update_incident(
    incident_id: str,
    *,
    title: str | None = None,
    description: str | None = None,
    status: str | None = None,
    severity: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    address: str | None = None,
    resolved_at: str | None = None,
) -> dict | None:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        updates = []
        params = []
        if title is not None:
            updates.append("title = %s")
            params.append(title)
        if description is not None:
            updates.append("description = %s")
            params.append(description)
        if status is not None:
            updates.append("status = %s")
            params.append(status)
        if severity is not None:
            updates.append("severity = %s")
            params.append(severity)
        if latitude is not None:
            updates.append("latitude = %s")
            params.append(latitude)
        if longitude is not None:
            updates.append("longitude = %s")
            params.append(longitude)
        if address is not None:
            updates.append("address = %s")
            params.append(address)
        if resolved_at is not None:
            updates.append("resolved_at = %s")
            params.append(resolved_at)
        if not updates:
            return get_incident_by_id(incident_id)
        params.append(incident_id)
        cur.execute(
            f"""UPDATE incidents SET {", ".join(updates)} WHERE id = %s
                RETURNING id, title, description, status, severity, latitude, longitude, address,
                          reported_at, created_by, resolved_at, created_at, updated_at""",
            params,
        )
        row = cur.fetchone()
        conn.commit()
        return dict(row) if row else None
    finally:
        if conn:
            return_connection(conn)


def list_incidents(
    status_filter: str | None = None,
    limit: int = 50,
    role: str | None = None,
    user_id: str | None = None,
) -> list[dict]:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        conditions = []
        params = []
        if role == "civilian" and user_id:
            # Civilians see only approved incidents (non-pending) or their own pending
            conditions.append("(status != %s OR created_by = %s)")
            params.extend(["pending", user_id])
        if status_filter:
            conditions.append("status = %s")
            params.append(status_filter)
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        params.append(limit)
        cur.execute(
            f"""
            SELECT id, title, status, severity, latitude, longitude, address, reported_at, created_at
            FROM incidents
            {where}
            ORDER BY reported_at DESC
            LIMIT %s
            """,
            params,
        )
        rows = cur.fetchall()
        cur.close()
        return [dict(r) for r in rows]
    finally:
        if conn:
            return_connection(conn)


def delete_incident(incident_id: str) -> bool:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM incidents WHERE id = %s", (incident_id,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        if conn:
            return_connection(conn)


def get_incident_by_id(
    incident_id: str,
    role: str | None = None,
    user_id: str | None = None,
) -> dict | None:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """
            SELECT id, title, description, status, severity, latitude, longitude, address,
                   reported_at, created_by, resolved_at, created_at, updated_at
            FROM incidents
            WHERE id = %s
            """,
            (incident_id,),
        )
        row = cur.fetchone()
        cur.close()
        if not row:
            return None
        d = dict(row)
        # Civilian can only view pending incident if they created it
        if role == "civilian" and d.get("status") == "pending":
            created_by = str(d["created_by"]) if d.get("created_by") else None
            if created_by != user_id:
                return None
        return d
    finally:
        if conn:
            return_connection(conn)

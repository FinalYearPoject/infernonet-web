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
) -> dict:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """INSERT INTO incidents (title, description, severity, latitude, longitude, address, created_by)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               RETURNING id, title, description, status, severity, latitude, longitude, address,
                         reported_at, created_by, resolved_at, created_at, updated_at""",
            (title, description, severity, latitude, longitude, address, created_by),
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


def list_incidents(status_filter: str | None = None, limit: int = 50) -> list[dict]:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        if status_filter:
            cur.execute(
                """
                SELECT id, title, status, severity, latitude, longitude, address, reported_at, created_at
                FROM incidents
                WHERE status = %s
                ORDER BY reported_at DESC
                LIMIT %s
                """,
                (status_filter, limit),
            )
        else:
            cur.execute(
                """
                SELECT id, title, status, severity, latitude, longitude, address, reported_at, created_at
                FROM incidents
                ORDER BY reported_at DESC
                LIMIT %s
                """,
                (limit,),
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


def get_incident_by_id(incident_id: str) -> dict | None:
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
        return dict(row) if row else None
    finally:
        if conn:
            return_connection(conn)

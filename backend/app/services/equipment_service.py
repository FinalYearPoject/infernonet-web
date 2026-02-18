import json
from app.core.database import get_connection, return_connection
from psycopg2.extras import RealDictCursor, Json


def list_equipment(
    organization_id: str | None = None,
    status: str | None = None,
    incident_id: str | None = None,
    limit: int = 100,
) -> list[dict]:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        conditions = []
        params = []
        if organization_id:
            conditions.append("organization_id = %s")
            params.append(organization_id)
        if status:
            conditions.append("status = %s")
            params.append(status)
        if incident_id:
            conditions.append("incident_id = %s")
            params.append(incident_id)
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        params.append(limit)
        cur.execute(
            f"""SELECT id, name, type, status, organization_id, incident_id, latitude, longitude, metadata, created_at, updated_at
                FROM equipment {where} ORDER BY name LIMIT %s""",
            params,
        )
        rows = cur.fetchall()
        out = []
        for r in rows:
            d = dict(r)
            if d.get("metadata") is not None and hasattr(d["metadata"], "copy"):
                d["metadata"] = d["metadata"] if isinstance(d["metadata"], dict) else json.loads(str(d["metadata"]))
            out.append(d)
        return out
    finally:
        if conn:
            return_connection(conn)


def get_equipment_by_id(equipment_id: str) -> dict | None:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """SELECT id, name, type, status, organization_id, incident_id, latitude, longitude, metadata, created_at, updated_at
               FROM equipment WHERE id = %s""",
            (equipment_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        d = dict(row)
        if d.get("metadata") is not None and not isinstance(d["metadata"], dict):
            d["metadata"] = json.loads(str(d["metadata"])) if d["metadata"] else {}
        return d
    finally:
        if conn:
            return_connection(conn)


def create_equipment(
    name: str,
    type: str,
    organization_id: str,
    status: str = "available",
    incident_id: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    metadata: dict | None = None,
) -> dict:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """INSERT INTO equipment (name, type, status, organization_id, incident_id, latitude, longitude, metadata)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id, name, type, status, organization_id, incident_id, latitude, longitude, metadata, created_at, updated_at""",
            (name, type, status, organization_id, incident_id, latitude, longitude, Json(metadata or {})),
        )
        row = cur.fetchone()
        conn.commit()
        d = dict(row)
        if d.get("metadata") is not None and not isinstance(d["metadata"], dict):
            d["metadata"] = d["metadata"] if isinstance(d["metadata"], dict) else json.loads(str(d["metadata"]))
        return d
    finally:
        if conn:
            return_connection(conn)


def update_equipment(
    equipment_id: str,
    *,
    name: str | None = None,
    type: str | None = None,
    status: str | None = None,
    incident_id: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    metadata: dict | None = None,
) -> dict | None:
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        updates = []
        params = []
        if name is not None:
            updates.append("name = %s")
            params.append(name)
        if type is not None:
            updates.append("type = %s")
            params.append(type)
        if status is not None:
            updates.append("status = %s")
            params.append(status)
        if incident_id is not None:
            updates.append("incident_id = %s")
            params.append(incident_id)
        if latitude is not None:
            updates.append("latitude = %s")
            params.append(latitude)
        if longitude is not None:
            updates.append("longitude = %s")
            params.append(longitude)
        if metadata is not None:
            updates.append("metadata = %s")
            params.append(Json(metadata))
        if not updates:
            return get_equipment_by_id(equipment_id)
        params.append(equipment_id)
        cur.execute(
            f"""UPDATE equipment SET {", ".join(updates)} WHERE id = %s
                RETURNING id, name, type, status, organization_id, incident_id, latitude, longitude, metadata, created_at, updated_at""",
            params,
        )
        row = cur.fetchone()
        conn.commit()
        if not row:
            return None
        d = dict(row)
        if d.get("metadata") is not None and not isinstance(d["metadata"], dict):
            d["metadata"] = d["metadata"] if isinstance(d["metadata"], dict) else json.loads(str(d["metadata"]))
        return d
    finally:
        if conn:
            return_connection(conn)

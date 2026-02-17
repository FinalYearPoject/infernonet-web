from fastapi import APIRouter, HTTPException, status
from app.database import get_connection, return_connection
from psycopg2.extras import RealDictCursor

router = APIRouter()


@router.get(
    "/incidents",
    summary="List incidents",
    description="Returns a list of fire incidents (active, contained, or resolved).",
)
def list_incidents(status_filter: str | None = None, limit: int = 50):
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
        return {"incidents": [dict(r) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        if conn:
            return_connection(conn)


@router.get(
    "/incidents/{incident_id}",
    summary="Get incident by ID",
    description="Returns a single incident by UUID.",
)
def get_incident(incident_id: str):
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
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
        return dict(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        if conn:
            return_connection(conn)

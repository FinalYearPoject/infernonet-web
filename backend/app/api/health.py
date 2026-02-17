from fastapi import APIRouter, status
from app.database import get_connection, return_connection

router = APIRouter()


@router.get(
    "/health",
    status_code=status.HTTP_200_OK,
    summary="Health check",
    description="Returns service and database health status.",
)
def health():
    db_ok = False
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.close()
        return_connection(conn)
        db_ok = True
    except Exception:
        pass
    return {
        "status": "healthy",
        "service": "InfernoNet API",
        "database": "ok" if db_ok else "error",
    }

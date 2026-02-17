from fastapi import FastAPI

from app.api import health, incidents

app = FastAPI(
    title="InfernoNet API",
    description="Smart communication for fire emergencies. Real-time collaboration for firefighters, emergency services, and civilians.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.include_router(health.router, tags=["Health"])
app.include_router(incidents.router, prefix="/api", tags=["Incidents"])

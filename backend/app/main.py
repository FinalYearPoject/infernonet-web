from fastapi import FastAPI

from app.api.routes import (
    auth,
    health,
    incidents,
    incident_updates,
    organizations,
    users,
    teams,
    equipment,
    alerts,
    channels,
)

app = FastAPI(
    title="InfernoNet API",
    description="Smart communication for fire emergencies. Real-time collaboration for firefighters, emergency services, and civilians.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.include_router(health.router, tags=["Health"])
app.include_router(auth.router, prefix="/api", tags=["Auth"])
app.include_router(organizations.router, prefix="/api", tags=["Organizations"])
app.include_router(users.router, prefix="/api", tags=["Users"])
app.include_router(incidents.router, prefix="/api", tags=["Incidents"])
app.include_router(incident_updates.router, prefix="/api", tags=["Incident updates"])
app.include_router(teams.router, prefix="/api", tags=["Teams"])
app.include_router(equipment.router, prefix="/api", tags=["Equipment"])
app.include_router(alerts.router, prefix="/api", tags=["Alerts"])
app.include_router(channels.router, prefix="/api", tags=["Channels"])

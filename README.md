# InfernoNet — Smart communication for fire emergencies

Real-time collaboration platform connecting firefighters, emergency services, and civilians: instant updates, resource tracking, and situational awareness during fire emergencies.

**Supervisor:** Prof. Ioanna Dionysiou, dionysiou.i@unic.ac.cy

## Requirements

- Docker and Docker Compose

## Run (PostgreSQL + Backend)

```bash
cp .env.example .env
# Edit .env if you need custom DB credentials

make run
# or: docker compose up -d --build
```

- **PostgreSQL** — `localhost:5432`
- **Backend (FastAPI)** — http://localhost:8000
- **Swagger UI** — http://localhost:8000/docs
- **ReDoc** — http://localhost:8000/redoc
- **OpenAPI JSON** — http://localhost:8000/openapi.json

Reset DB and restart: `make run-clean`

### Connection string

```
postgres://infernonet:infernonet_secret@localhost:5432/infernonet?sslmode=disable
```

## Schema overview

| Table | Purpose |
|-------|---------|
| `organizations` | Fire departments, emergency services |
| `users` | Firefighters, coordinators, civilians (role-based) |
| `incidents` | Fire events with location, status, severity |
| `teams` / `team_members` | Teams and assignments to incidents |
| `equipment` | Resources, status, location (incl. IoT/drones) |
| `alerts` | Emergency alerts linked to incidents |
| `channels` / `channel_members` / `messages` | Team/incident chat |
| `user_locations` | Live location for mapping |
| `incident_updates` | Incident timeline / status updates |

Migrations run automatically when the Postgres container is first created (`migrations/` → `/docker-entrypoint-initdb.d`).

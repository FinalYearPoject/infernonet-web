# InfernoNet — Smart communication for fire emergencies

Real-time collaboration platform connecting firefighters, emergency services, and civilians: instant updates, resource tracking, and situational awareness during fire emergencies.

**Supervisor:** Prof. Ioanna Dionysiou, dionysiou.i@unic.ac.cy

## Database & Docker

### Requirements

- Docker and Docker Compose

### Run PostgreSQL and apply migrations

```bash
cp .env.example .env
# Edit .env if you need custom DB credentials

docker compose up -d postgres
docker compose run --rm migrate
```

Or start everything (Postgres will start first, then migrations run once):

```bash
docker compose up -d
```

- **PostgreSQL** is available at `localhost:5432` (or `POSTGRES_PORT` from `.env`).
- **Migrations** are in `migrations/` (golang-migrate format: `*_name.up.sql` / `*_name.down.sql`).

### Connection string

```
postgres://infernonet:infernonet_secret@localhost:5432/infernonet?sslmode=disable
```

(Use values from your `.env` if you changed them.)

### Schema overview

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

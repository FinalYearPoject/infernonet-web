# InfernoNet — Developer Diary

**Project:** InfernoNet — Smart communication for fire emergencies  
**Supervisor:** Prof. Ioanna Dionysiou, dionysiou.i@unic.ac.cy  

---

## Entry 1 — Project Kickoff and Architecture Decisions

### What is InfernoNet?

InfernoNet is a real-time collaboration platform designed to improve communication and coordination during fire emergencies. The system connects three types of actors: **firefighters**, **coordinators** (emergency services managers), and **civilians**. The core problem it solves is the lack of effective, structured communication during active incidents — teams are uncoordinated, resources are not tracked, and civilians lack timely warnings.

The platform provides:
- Live incident tracking with geolocation
- Role-based access for different user types
- Team management and member assignments
- Equipment and resource tracking (including IoT sensors and drones)
- Emergency alert broadcasting
- Real-time chat channels per incident or team
- Live user location mapping

---

### Why start with the backend?

The decision was made to start with the **backend API layer** before any frontend or mobile work. The reasoning is straightforward: both the web interface and the future Android application will consume the same API. Building it first:
- Forces clear domain modelling early in the project
- Allows the API contract to be defined and tested before UI work begins
- Lets multiple team members work in parallel later (frontend vs backend)
- Produces a working, testable product at every stage

---

### Technology choices

#### FastAPI (Python)

FastAPI was chosen as the web framework for several reasons:

1. **Performance** — FastAPI is built on top of Starlette and uses ASGI, making it one of the fastest Python frameworks available (on par with Node.js and Go in benchmarks).
2. **Automatic documentation** — FastAPI generates interactive Swagger UI (`/docs`) and ReDoc (`/redoc`) from the code itself, with no extra configuration. This is invaluable for a project where API clarity matters.
3. **Data validation** — Integration with Pydantic means all request bodies and query parameters are automatically validated. Errors are returned as structured JSON with clear messages.
4. **Type safety** — Python type hints are used throughout, which improves IDE support, makes the code self-documenting, and reduces runtime bugs.
5. **Familiarity** — Python is well-suited for rapid prototyping in an academic setting while still producing production-quality code.

#### PostgreSQL

PostgreSQL was chosen as the primary data store for the following reasons:

1. **Relational data model** — The InfernoNet domain has naturally relational data: organizations own teams, incidents are linked to updates and alerts, channels belong to incidents or teams. A relational database enforces these constraints at the data layer.
2. **Constraints and integrity** — Foreign keys, `CHECK` constraints (e.g. `role IN ('firefighter', 'coordinator', 'civilian')`), and `UNIQUE` constraints ensure data consistency without extra application logic.
3. **JSONB** — The `equipment.metadata` column uses PostgreSQL's native `JSONB` type, allowing flexible storage of IoT/sensor/drone-specific data without requiring schema changes.
4. **UUID primary keys** — All entities use UUID primary keys (`gen_random_uuid()`), which avoids sequential ID enumeration, distributes nicely across shards if needed later, and is safe to expose in URLs.
5. **Triggers** — An `update_updated_at_column()` trigger function automatically maintains `updated_at` timestamps on all mutable tables, removing boilerplate from application code.

#### Docker Compose

Docker Compose was chosen as the development and deployment orchestrator:

1. **Single-command startup** — `make run` (or `docker compose up -d --build`) starts the entire stack (database + backend) with no manual steps.
2. **Isolation** — Each service runs in its own container, preventing "works on my machine" problems.
3. **Health checks** — The backend container waits for PostgreSQL to be fully ready (via `pg_isready` healthcheck with `condition: service_healthy`) before starting. This prevents startup race conditions.
4. **Volume persistence** — The PostgreSQL data directory is mounted as a named Docker volume (`postgres_data`), so data survives container restarts.
5. **Easy reset** — `make run-clean` (`docker compose down -v && docker compose up -d --build`) destroys all volumes and recreates from scratch — ideal during early development.

---

## Entry 2 — Database Design

### Schema overview

The database schema is defined in a single SQL migration file: `migrations/01_init_schema.sql`. This file is automatically executed by PostgreSQL when the container is first created — it is placed in `/docker-entrypoint-initdb.d/`, which is a convention of the official `postgres` Docker image.

The schema contains the following tables:

| Table | Purpose |
|---|---|
| `organizations` | Fire departments, emergency services, municipalities |
| `users` | All platform users with role-based access |
| `incidents` | Active and historical fire emergencies |
| `teams` | Firefighting teams, linked to an organization and optionally an incident |
| `team_members` | Many-to-many join between users and teams |
| `equipment` | Physical resources (vehicles, drones, pumps, sensors) |
| `alerts` | Emergency alerts that can be broadcast to civilians |
| `channels` | Chat channels scoped to an incident, a team, or general use |
| `channel_members` | Many-to-many join between users and channels |
| `messages` | Chat messages within a channel |
| `user_locations` | Latest known location per user (for live map) |
| `incident_updates` | Timeline of status changes and notes for an incident |

### Design decisions

**UUIDs everywhere.** All primary keys are UUIDs. This was a deliberate choice: UUIDs are safe to expose in API URLs, they do not leak record counts, and they can be generated client-side if needed.

**Enumerated values as CHECK constraints.** Instead of separate lookup tables for small enumerations, `CHECK` constraints were used directly on the column:
```sql
role VARCHAR(30) NOT NULL CHECK (role IN ('firefighter', 'coordinator', 'civilian'))
status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('reported', 'active', 'contained', 'resolved'))
severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical'))
```
This keeps the schema lean while still enforcing valid values at the database level.

**Channel scope constraint.** Channels can belong to either an incident, a team, or neither (general). They cannot belong to both. This is enforced by a table-level constraint:
```sql
CONSTRAINT channel_scope CHECK (
    (incident_id IS NOT NULL AND team_id IS NULL) OR
    (incident_id IS NULL AND team_id IS NOT NULL) OR
    (incident_id IS NULL AND team_id IS NULL)
)
```
This constraint is also validated in the Pydantic schema on the API layer (a `@model_validator` in `ChannelCreate`).

**Equipment metadata as JSONB.** The `equipment.metadata` column stores arbitrary key-value data as `JSONB`. This accommodates heterogeneous equipment types — a fire truck might have `{"plate": "FIRE-01", "capacity_liters": 5000}` while a drone has `{"model": "DJI-M300", "max_flight_time_min": 45}` — without requiring separate tables per equipment type.

**`updated_at` triggers.** Rather than updating `updated_at` in every service function, a PostgreSQL trigger function is registered on all mutable tables:
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```
This guarantees the field is always accurate regardless of how the row is updated.

---

## Entry 3 — Backend Architecture

### Directory structure

```
backend/
├── Dockerfile
├── requirements.txt
└── app/
    ├── main.py              # Application entry point, router registration
    ├── core/
    │   ├── config.py        # Configuration from environment variables
    │   ├── database.py      # PostgreSQL connection pool
    │   └── security.py      # Password hashing and verification (bcrypt)
    ├── api/
    │   └── routes/          # HTTP layer: thin handlers, no business logic
    │       ├── health.py
    │       ├── organizations.py
    │       ├── users.py
    │       ├── incidents.py
    │       ├── incident_updates.py
    │       ├── teams.py
    │       ├── equipment.py
    │       ├── alerts.py
    │       ├── channels.py
    │       └── user_locations.py
    ├── services/            # Business logic and database access
    │   ├── organization_service.py
    │   ├── user_service.py
    │   ├── incident_service.py
    │   ├── incident_updates_service.py
    │   ├── team_service.py
    │   ├── equipment_service.py
    │   ├── alert_service.py
    │   ├── channel_service.py
    │   └── user_location_service.py
    └── schemas/             # Pydantic request/response models
        ├── organization.py
        ├── user.py
        ├── incident.py
        ├── team.py
        ├── equipment.py
        ├── alert.py
        ├── channel.py
        └── user_location.py
```

### Layer responsibilities

**`core/`** — Infrastructure. The `config.py` reads all configuration from environment variables (database host, port, credentials), allowing the same code to run locally and in any container environment without changes. `database.py` manages a `psycopg2.pool.SimpleConnectionPool`, which reuses connections efficiently instead of opening a new connection per request. `security.py` provides `hash_password` and `verify_password` using `bcrypt` directly.

**`api/routes/`** — The HTTP layer. Route handlers are intentionally thin: they parse the request, call the appropriate service function, and return the result or raise an `HTTPException`. No SQL is written here.

**`services/`** — Business logic and data access. Each service module handles one resource domain. Service functions acquire a connection from the pool, execute parameterized SQL queries, commit if needed, and always return the connection to the pool in a `finally` block to prevent leaks.

**`schemas/`** — Pydantic models that define what the API accepts and returns. Validation happens automatically before the route handler is called. Invalid input returns a structured `422 Unprocessable Entity` response.

### Why psycopg2 instead of an ORM?

An ORM (like SQLAlchemy) was considered but ultimately not used. For this project, raw SQL with psycopg2 was preferred because:
- The queries are simple and well-understood
- There is no "N+1 problem" in the current access patterns
- `RealDictCursor` returns rows as dictionaries, which map directly to JSON responses
- It avoids the abstraction overhead and configuration complexity of an ORM
- Parameterized queries prevent SQL injection natively

---

## Entry 4 — API Endpoints

### Full endpoint reference

| Group | Method | Path | Description |
|---|---|---|---|
| **Health** | GET | `/health` | Service and database status |
| **Organizations** | GET | `/api/organizations` | List all organizations |
| | POST | `/api/organizations` | Create a new organization |
| | GET | `/api/organizations/{id}` | Get organization by ID |
| **Users** | GET | `/api/users` | List users (filterable by `role`, `organization_id`) |
| | POST | `/api/users` | Register a user (password hashed with bcrypt) |
| | GET | `/api/users/{id}` | Get user by ID |
| **Incidents** | GET | `/api/incidents` | List incidents (filterable by `status`) |
| | POST | `/api/incidents` | Create a new incident (with coordinates) |
| | GET | `/api/incidents/{id}` | Get incident by ID |
| | PATCH | `/api/incidents/{id}` | Update status, severity, location |
| **Incident updates** | GET | `/api/incidents/{id}/updates` | Incident timeline |
| | POST | `/api/incidents/{id}/updates` | Add a timeline entry |
| **Teams** | GET | `/api/teams` | List teams |
| | POST | `/api/teams` | Create a team |
| | GET | `/api/teams/{id}` | Get team by ID |
| | PATCH | `/api/teams/{id}` | Update team (e.g. assign to incident) |
| | GET | `/api/teams/{id}/members` | List team members |
| | POST | `/api/teams/{id}/members` | Add a member |
| | DELETE | `/api/teams/{id}/members/{user_id}` | Remove a member |
| **Equipment** | GET | `/api/equipment` | List equipment (filterable by `status`, `incident_id`) |
| | POST | `/api/equipment` | Create equipment (supports `metadata` JSONB) |
| | GET | `/api/equipment/{id}` | Get equipment by ID |
| | PATCH | `/api/equipment/{id}` | Update status, location, incident assignment |
| **Alerts** | GET | `/api/alerts` | List alerts (filterable by `incident_id`) |
| | POST | `/api/alerts` | Create an alert |
| | GET | `/api/alerts/{id}` | Get alert by ID |
| **Channels** | GET | `/api/channels` | List channels |
| | POST | `/api/channels` | Create a channel (incident, team, or general) |
| | GET | `/api/channels/{id}` | Get channel by ID |
| | POST | `/api/channels/{id}/members` | Add a channel member |
| | GET | `/api/channels/{id}/messages` | List messages (paginated) |
| | POST | `/api/channels/{id}/messages` | Send a message |
| **User locations** | GET | `/api/user-locations` | All live locations (for map rendering) |
| | PUT | `/api/user-locations` | Upsert current user location |
| | GET | `/api/users/{id}/location` | Get a specific user's location |

### API documentation

FastAPI generates interactive documentation automatically from the code. Three formats are available once the backend is running:

- **Swagger UI** — http://localhost:8000/docs (interactive, allows sending requests directly from the browser)
- **ReDoc** — http://localhost:8000/redoc (clean, readable reference)
- **OpenAPI JSON** — http://localhost:8000/openapi.json (machine-readable schema, can be imported into Postman)

---

## Entry 5 — Security Notes

### Password storage

User passwords are **never stored in plaintext**. On registration, the password is hashed using `bcrypt` (cost factor 12) before being written to the database. The `password_hash` field is never returned in any API response.

```python
import bcrypt

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())
```

> **Note:** `passlib` was initially used as a bcrypt wrapper but was removed because it is unmaintained and incompatible with `bcrypt >= 4.x`. The library was replaced with direct use of the `bcrypt` package.

### What is not yet implemented

- JWT authentication — endpoints are currently unauthenticated. Token-based auth is the planned next step.
- Role-based access control (RBAC) — the `role` field exists in the database but is not yet enforced at the API layer.
- HTTPS — handled at the reverse proxy level in production.

---

## Entry 6 — Running the Project

### Prerequisites

- Docker (v24+)
- Docker Compose (included with Docker Desktop)
- `make` (available on macOS/Linux by default)
- Postman (optional, for testing)

### First-time setup

```bash
# Clone the repository
git clone <repo-url>
cd infernonet-web

# Copy environment variables (edit if needed)
cp .env.example .env
```

The `.env` file contains:
```env
POSTGRES_USER=infernonet
POSTGRES_PASSWORD=infernonet_secret
POSTGRES_DB=infernonet
POSTGRES_PORT=5432
```

### Starting the stack

```bash
make run
# equivalent to: docker compose up -d --build
```

This command:
1. Builds the backend Docker image from `backend/Dockerfile`
2. Starts the `postgres` container (postgres:15-alpine)
3. Waits for PostgreSQL to pass its health check
4. Starts the `backend` container once the database is ready
5. PostgreSQL automatically executes `migrations/01_init_schema.sql` on first run

### Verifying the startup

```bash
# Check both containers are running
docker compose ps

# Check backend logs
docker compose logs backend

# Quick API check
curl http://localhost:8000/health
# Expected: {"status":"healthy","service":"InfernoNet API","database":"ok"}
```

### Resetting the database

```bash
make run-clean
# equivalent to: docker compose down -v && docker compose up -d --build
```

This destroys the `postgres_data` volume, removing all data, and recreates the schema from scratch. Useful during development when the schema changes.

### Cleaning Python cache files

```bash
make cache-clean
```

### Stopping the stack

```bash
docker compose down
```

### Service URLs summary

| Service | URL |
|---|---|
| Backend API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |
| OpenAPI JSON | http://localhost:8000/openapi.json |
| PostgreSQL | localhost:5432 (user: `infernonet`, db: `infernonet`) |

---

## Entry 7 — Testing with Postman

A Postman collection is provided in `postman/`:

- `InfernoNet-API.postman_collection.json` — full collection with automated tests
- `InfernoNet-Local.postman_environment.json` — environment with `base_url` and variable placeholders

### Import steps

1. Open Postman → **Import** → select both files from `postman/`
2. Select environment: **InfernoNet Local**
3. Open **Collections → InfernoNet API → Run**

### What the collection tests

The collection is organized in 9 sequential folders (01–09). Each request includes:

- **Status code assertions** — verifies the correct HTTP status (200, 201, 204, 404, 409, 422)
- **Response body assertions** — checks field values, types, and constraints
- **Auto-saved IDs** — after each `POST` (Create), the returned `id` is saved to an environment variable using `pm.environment.set()`, so subsequent requests automatically use the correct IDs

**Chaining example:**
```
Create organization → saves org_id
Create coordinator  → saves coordinator_id (uses org_id)
Create firefighter  → saves user_id (uses org_id)
Create incident     → saves incident_id (uses coordinator_id)
Create team         → saves team_id (uses org_id + incident_id)
Create channel      → saves channel_id (uses incident_id)
Send messages       → uses channel_id + user_id + coordinator_id
```

**Negative tests included:**
- Registering with a duplicate email → `409 Conflict`
- Fetching a non-existent user → `404 Not Found`
- Creating a channel with both `incident_id` and `team_id` → `422 Unprocessable Entity`

---

## Entry 8 — Known Issues and Troubleshooting

### `passlib` / bcrypt incompatibility

**Symptom:** `AttributeError: module 'bcrypt' has no attribute '__about__'` on user creation.  
**Cause:** `passlib 1.7.4` was written before `bcrypt 4.x`, which removed the `__about__` attribute.  
**Fix:** Removed `passlib` entirely. Now using `bcrypt` directly.

### `email-validator` not installed

**Symptom:** `ImportError: email-validator is not installed` on startup.  
**Cause:** Pydantic's `EmailStr` type requires the `email-validator` package, which is not bundled with `pydantic`.  
**Fix:** Added `email-validator==2.2.0` to `requirements.txt`.

### `CREATE INDEX IF NOT EXISTS` parsing errors in diagram tools

**Symptom:** SQL diagram tools (e.g. dbdiagram.io) reject `CREATE INDEX IF NOT EXISTS`.  
**Cause:** Some diagram tools implement a subset of SQL and do not support `IF NOT EXISTS` on `CREATE INDEX`.  
**Fix:** Removed `IF NOT EXISTS` from all `CREATE INDEX` statements. This has no impact on the Docker-based migration, which runs on a fresh database.
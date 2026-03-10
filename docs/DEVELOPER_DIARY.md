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

## Entry 8 — Role Model, UX Decisions and Rationale

This entry documents the final state of the application after the latest iteration, focusing on:
- **Why** each feature exists,
- **Which role** (civilian, firefighter, coordinator) can use it,
- **What data structures and backend concepts** support it.

The description is written in the style of an oral exam / thesis defense: *“why did you design it this way?”*.

### 8.1 Roles and access model

There are three roles, stored as an enum-like string in the `users.role` column (`'civilian' | 'firefighter' | 'coordinator'`). Role information is carried in:
- PostgreSQL (`users.role` with a `CHECK` constraint),
- backend Pydantic schemas,
- frontend `localStorage` (a compact `infernonet_user` JSON used by the router and UI).

**Civilian**
- Can log in and:
  - See the **Incidents** list.
  - See **Incident detail** (status, timeline, map).
  - See **Live Map** with incidents.
  - **Report a new incident** via the “Report Incident” button.
- Cannot:
  - See `Users`, `Organizations`, `Equipment`, `Hot Dashboard`.
  - Edit incidents, add alerts, manage channels, manage teams, or equipment.
- Rationale:
  - Civilians are “sources of signals” (reports) and consumers of public information (map, incident statuses), but not operators of the system.
  - This keeps the UI and mental model extremely simple for non‑technical, possibly stressed users.

**Firefighter**
- Can:
  - Access the **Hot Dashboard** (only firefighters see this entry in the navbar).
  - See **Incidents**, **Incident detail**, **Live Map**.
  - Join **teams** and **channels** when assigned by a coordinator.
  - Add **timeline comments** when changing incident status (through their actions, depending on policy).
- Cannot:
  - Create new organizations, teams, users.
  - Create or delete incidents themselves (this is left to coordinators in this version).
- Rationale:
  - Firefighters need **quick situational awareness**: which incidents am I on, what alerts were sent, which radio/chat channels to follow, which vehicles/drones are attached.
  - They should not be distracted by administrative screens (user management, organizations, etc.), but still need full clarity on the operational picture.

**Coordinator**
- Can:
  - Everything a firefighter can, plus:
  - Manage **Users** (create, edit, delete).
  - Manage **Organizations**.
  - Manage **Equipment** (vehicles, drones, sensors etc.).
  - Create and update **Incidents**, assign teams, update status/severity.
  - Send **Alerts** for an incident.
  - Manage **Channels** and their members.
- Rationale:
  - Coordinator is essentially the “control room”: they administer the system, assign resources, and perform broadcast communication. Therefore they have access to all CRUD endpoints on organizations, users, equipment, teams, alerts and incidents.

The role logic is enforced:
- On the **frontend router**:
  - Civilians are redirected away from `/users`, `/organizations`, `/equipment` and `/dashboard`.
  - The navigation bar hides inappropriate links (e.g. civilians do not even see “Users”).
  - Hot Dashboard is visible only for firefighters (`data-firefighter-only` attribute).
- On the **backend**:
  - Sensitive endpoints (e.g. incident updates) use `get_current_user` and raise `403` when role is not sufficient.

### 8.2 Organizations and why they are visible

**Question from client:** “Which organizations did you include and why?”

In the current schema, the `organizations` table models entities such as:
- Fire departments (`FIRE_DEPARTMENT`),
- Central emergency services (`EMERGENCY_SERVICES`),
- Government bodies (`GOVERNMENT`),
- NGOs / volunteer groups (`NGO`),
- “Other” types for anything not covered.

Each `user` is linked to exactly one `organization_id`.  
Each `team` also belongs to an organization.  
Each `equipment` record is owned by an organization.

**Why coordinators see all organizations:**
- To answer practical questions during an emergency:
  - “Which department owns this truck/drone?”
  - “Which NGO has personnel on this incident?”
  - “Whom can I contact if I need more resources in this region?”
- To make it easy to:
  - Onboard new firefighters under the correct department.
  - Create teams tied to their host organization.
  - Track equipment usage per organization (for later reporting / accountability).

On the **frontend**, the Organizations page shows:
- Name,
- Type (formatted from enum `EMERGENCY_SERVICES` → “Emergency services” etc.),
- Phone,
- Address,
- Created date.

The „type“ is stored as a small string (e.g. `'fire_department'`), and rendered via a helper:
- `formatOrgType` replaces underscores with spaces and capitalizes words,
- Type is also mapped to CSS classes (badges) for quick visual distinction.

Civilian and firefighter **do not** see this page at all — only coordinators do. This keeps sensitive organizational structure and PII restricted to staff.

### 8.3 Users: why show all users and their basic activity

**Question from client:** “Why do we see all users and their activity?”

The **Users** page is the main tool for coordinators to manage human resources:

- It lists:
  - full name + email,
  - role,
  - organization,
  - phone,
  - **status badge** (Active / Inactive),
  - created date.
- It offers filters:
  - search by name/email,
  - filter by role (firefighter, coordinator, civilian).

The “activity” in this context is not detailed logs but **whether the user is active or inactive** (`users.is_active`). This allows coordinators to:
- Disable accounts that should no longer be used without deleting historical data,
- Quickly see if a user is supposed to be available for team assignment.

Structurally:
- `users` is a first-class table with foreign key `organization_id`.
- The frontend maintains a cached `orgMap` and uses it to render human‑readable org names.
- Pagination is applied so that a long list of users remains manageable (`PAGE_SIZE` + per‑page selector).

Firefighters and civilians **never** see this list. It’s purely an administrative view.

### 8.4 Incidents and timeline: why the design is like this

Incidents are the central object of the system. The design goals were:

- Give **civilians** a simple way to report an incident (title, description, map click for coordinates, optional address).
- Give **coordinators** and **firefighters** a rich detail view with:
  - status,
  - severity,
  - geolocation and map,
  - teams assigned,
  - equipment assigned,
  - channels,
  - alerts,
  - timeline.

#### Status and severity

`incidents.status` uses a small enum: `pending`, `reported`, `active`, `contained`, `resolved`.
- **Pending** is important because civilians can submit reports that have not yet been validated by staff.
- The **Incidents list** splits rows into logical sections:
  - `Pending`,
  - `Active`,
  - `Inactive` (resolved).
- A `Hide inactive` checkbox (default ON) hides resolved incidents from the “Active” view, but they can be brought back when the checkbox is cleared.

This is implemented entirely on the frontend with helper functions that group incidents and inject section header rows (`<tr class="section-row">`), but the underlying data is a simple array of incident JSON objects received from the backend.

#### Timeline and why updates are tied to status changes

There is a dedicated table `incident_updates`:
- `incident_id`,
- `user_id`,
- `content` (human‑written comment),
- `status_before`,
- `status_after`,
- `created_at`.

Initially the UI allowed manual timeline updates via a separate “Add Update” button. However, that made it hard to trace *why* and *when* a status changed versus when someone just wrote a note.

In the final design:
- We **removed** standalone “Add Update”.
- Timeline entries are created **only when status is edited** via the “Edit Incident Status” modal.
- The modal has:
  - new status,
  - new severity,
  - optional **Comment (appears in Timeline)**.
- On submit:
  1. Backend `PATCH /incidents/{id}` updates `status` and `severity`.
  2. If there is a comment, the frontend then calls `POST /incidents/{id}/updates` with:
     - `content` = comment,
     - `status_before` = old status,
     - `status_after` = new status.

**Why this is better:**
- Every timeline item now documents a **concrete change in incident state**.
- The combination of `status_before` and `status_after` is used in the UI to show a badge sequence (e.g. `ACTIVE → CONTAINED`) next to the comment.
- The data structure directly supports answering “who changed the status, when, and what was the operator’s reasoning?”.

### 8.5 Teams, channels and why they’re linked to incidents

**Teams** (`teams`, `team_members`) and **channels** (`channels`, `channel_members`, `messages`) are the coordination backbone.

- When a coordinator creates a team and assigns it to an incident (`teams.incident_id`), they can then:
  - Add firefighters to that team (via `team_members`).
  - Automatically or manually create channels tied to the same incident.
- A **team membership** implicitly means:
  - The firefighter is “assigned” to that incident.
  - Their incident will appear on **Hot Dashboard** (backend endpoint `/teams?member_id=...` is used to find teams where the current user is a member; their `incident_id` list then drives the dashboard queries).

Channels:
- Are scoped with `incident_id` and/or `team_id` (enforced via the `channel_scope` constraint).
- Civilians see only **public** channels, and even тогда только в ограниченном объёме (e.g. they cannot manage members).
- Coordinators can create both public and private channels.

**Rationale:**
- Real incidents are always handled by **groups**, not individual people. Out‑of‑band chats (WhatsApp, phone) are hard to audit and coordinate, so the system provides a structured channel per incident/team.
- Linking teams to incidents, and channels to teams/incidents, allows us to derive:
  - For firefighter: “show me only channels relevant to incidents I am on”.
  - For coordinator: “which teams and channels exist for this incident; do I need to add more?”.

Data‑structure wise, this is classic **many‑to‑many**:
- `team_members(team_id, user_id, role_in_team)`,
- `channel_members(channel_id, user_id)`.

### 8.6 Equipment: why attach it to incidents and organizations

Equipment has these key fields:
- `organization_id` — owner,
- `incident_id` — if currently assigned to an incident,
- `status` — `available`, `in_use`, `maintenance`, `unavailable`,
- `latitude`, `longitude` — approximate position,
- `metadata JSONB` — type-specific data.

**Why coordinators see Equipment:**
- They are responsible for allocating scarce resources:
  - fire trucks,
  - drones,
  - pumps,
  - sensor networks.
- The list shows:
  - name / type,
  - status,
  - organization,
  - linked incident,
  - current location,
  - creation date.

On the **Incidents** page:
- Under each incident, we show which equipment is assigned to it (chip list in the Hot Dashboard and a dedicated table in Incident detail).

On the **Hot Dashboard**:
- For each assigned incident, the firefighter sees all equipment attached to that incident:
  - name,
  - status badge (`IN USE`, `AVAILABLE` etc.),
  - owning organization.

Structurally this gives us:
- A 1‑to‑many relation `organizations → equipment`.
- A 1‑to‑many relation `incidents → equipment`.
- Ability to query “all equipment on this incident” (`equipment.incident_id = :id`) without additional join tables.

### 8.7 Hot Dashboard: why firefighters have a separate view

The **Hot Dashboard** is a firefighter‑only page that aggregates:
- Incidents where the firefighter is a team member,
- Alerts, channels, and equipment for those incidents,
- A direct **Route (Maps)** button for navigation.

**Why a separate dashboard instead of reusing the Incidents list:**
- Firefighter needs a **very focused** view:
  - Only incidents they are assigned to.
  - No administrative tables or global filters.
  - Quick “open channel”, “see equipment”, “see alerts” actions.
- The underlying data is derived from:
  - `team_members` (filter by `user_id`),
  - `teams.incident_id` (incidents list),
  - `alerts`, `channels`, `equipment` filtered by each incident.

The dashboard also has:
- `Hide inactive` checkbox (hides resolved incidents by default),
- **Pagination + per-page selector** to avoid huge scroll lists if a firefighter is attached to many incidents (for example, in large wildfires or when reviewing history).

The **Route (Maps)** button:
- Generates a standard Google Maps URL:
  - `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>`,
- Opens in a new tab.
- Rationale:
  - Offloading actual routing and navigation to Google Maps (or any other navigator) is pragmatic: the app does not need to implement routing algorithms; it just provides a correct destination point.

### 8.8 Frontend structure and UI decisions

The frontend is a small but carefully structured SPA:

- **Routing**:
  - Implemented in `router.js` using hash‑based routes (`#/incidents`, `#/incidents/:id`, `#/users`, `#/equipment`, `#/organizations`, `#/dashboard`, `#/map`).
  - `resolveHash` contains the auth guard and role redirects.

- **Pages**:
  - Each main view lives in its own `frontend/js/pages/*.js` file:
    - `incidents.js`, `incident.js`, `users.js`, `equipment.js`, `organizations.js`, `dashboard.js`, `map.js`, `channels.js`.
  - Each page:
    - Fetches data through the `api` client,
    - Renders HTML into `#app` via the `mount()` helper,
    - Attaches DOM event listeners (buttons, filters, pagination).

- **Pagination and filtering**:
  - Implemented purely on the client side using arrays in memory.
  - Central helpers in `router.js` avoid code duplication.
  - Every big table page (Incidents, Users, Organizations, Equipment) now has:
    - Pagination controls (Prev/Next, “X–Y of Z”, page count),
    - Per-page selector,
    - In some cases additional filters (status, role, search query, organization).

**Why vanilla JS and not React/Vue/Angular?**
- The main goal of the project is to demonstrate **backend/API design and role-based domain modeling**.
- A custom, lightweight SPA with ~a few hundred lines of JS per page is:
  - Easy to reason about during an exam (no framework lifecycle to explain),
  - Transparent: the examiner can literally read the whole control flow,
  - Enough to show good UX patterns (modals, filter bars, responsive tables, badges, chips, maps).

---

This entry should give a supervisor a clear view of **what** the system does for each actor, **why** the features exist, and **how** they are implemented (both in database schema and in frontend behavior).

---

## Entry 9 — Client-driven Iterations (What Changed and Why)

This entry addresses additional client questions and clarifies **why certain features were added, removed, or constrained** in the final version.

### 9.1 Why Live Map shows incidents (not live user locations)

The initial concept included *live user location mapping* (table `user_locations` and related endpoints). During iteration we intentionally **removed** the live user location layer and redefined **Live Map** as:

- “A map of **incidents** (their coordinates, status and severity)”
- not “a map of **people**”.

**Rationale:**
- **Privacy and safety:** tracking people in real time is sensitive (especially civilians). Even for staff, it creates additional compliance requirements and risk.
- **Operational value:** for decision-making, the most stable reference point is the **incident location** and its state (reported/active/contained/resolved). User locations can be noisy and ambiguous.
- **Simpler correctness:** incident coordinates are part of the incident record and are validated at creation time; user locations require continuous updates, retention logic, and more complex UI behavior.

**Data model impact:**
- Live Map now uses the existing `incidents` structure: `latitude`, `longitude`, `status`, `severity`.
- This removed the need for the `user_locations` table and API routes in the final workflow.

### 9.2 Civilian workflow: why “Pending” exists and what the civilian can do

**Client request:** “What functions does the civilian have and why did you choose that functionality?”

Civilian is treated as a *reporting actor* with minimal, safe functionality:

**Civilian can:**
- View **Incidents** list and **Incident detail**.
- Use **Live Map** to understand what is happening geographically.
- **Report Incident** by providing:
  - title and description,
  - coordinates by clicking on an embedded map (to reduce address ambiguity),
  - optional address text.

**Civilian cannot:**
- Create alerts or channels,
- Manage teams or equipment,
- Manage users or organizations,
- Post operational updates in the timeline.

**Why “Pending”:**
- Civilian reports are valuable but can be **unverified** (duplicates, false alarms, incomplete data).
- Therefore civilian-created incidents start as `status = 'pending'`.
- Staff (coordinator/firefighter, per policy) can review and “promote” an incident by setting status to `reported/active/...`.

**UX rationale:**
- The Incidents list visually separates `Pending` from staff-verified states.
- Civilians see a limited incident dataset: approved incidents + their own pending reports (so the reporter can check if their request is acknowledged).

**Data structures:**
- `incidents.status` adds a new enum value `pending`.
- Simple **role-based filtering** is applied on backend list/get operations (civilians do not get full staff view).

### 9.3 Coordinator capabilities: what they can do and why

**Client request:** “What can a coordinator do, and why does the coordinator need organizations management?”

Coordinator is the *control room* role. They can:

- **Incidents**
  - create incident records (internal reports),
  - update incident status and severity,
  - (in the current policy) delete incidents when appropriate.
- **Teams**
  - create teams under an organization,
  - assign teams to incidents,
  - add/remove team members.
- **Alerts**
  - broadcast alerts tied to an incident (public safety messaging).
- **Channels**
  - create channels, set public/private visibility,
  - add/remove channel members,
  - use channels as operational communications.
- **Equipment**
  - add and update resources,
  - assign equipment to incidents,
  - track status and approximate location.
- **Users / Organizations**
  - onboard staff and civilians,
  - tie users to correct organizations,
  - keep organizational directory and contact data.

**Why manage organizations:**
- Organizations provide the “ownership” backbone:
  - who owns equipment,
  - which department a user belongs to,
  - which organization hosts a team.
- This is critical for realistic emergency operations: resource allocation and accountability always depend on which department/agency controls assets.

**Example organizations (demo dataset):**
- “Central Fire Department” (type `FIRE_DEPARTMENT`)
- “Emergency Services” (type `EMERGENCY_SERVICES`)
- “Coordinators” / “NGO” examples as auxiliary actors

The system supports these as **types**, and the actual list can be extended by coordinators.

### 9.4 Firefighter capabilities: what they can do and why

**Client request:** “What can a firefighter do and why did you decide it that way?”

Firefighters are optimized for **fast consumption of operational context**:

**Firefighter can:**
- Use **Hot Dashboard** to instantly see:
  - incidents they are assigned to (derived from team membership),
  - alerts/channels/equipment for those incidents,
  - a **Google Maps route** button to the incident coordinates.
- Use **Incident detail** to:
  - read the timeline,
  - see teams and assigned equipment,
  - open incident channels.
- Participate in channels and read updates.

**Why not give firefighters admin pages:**
- During active operations, UI should be focused on “what do I need right now?”.
- Administrative actions (user/org CRUD) have higher risk of accidental changes and are not part of on-ground responsibilities.

**Assignment model:**
- Firefighter assignment is represented by the join table `team_members`.
- A team has `incident_id`, which allows us to derive “incidents assigned to this firefighter” without creating an extra assignment table.

### 9.5 Why we removed standalone “Add Timeline Update”

We intentionally removed direct “Add Update” to avoid a timeline becoming a free-form chat log.

**New rule:** timeline entries are created through the **Edit Incident Status** flow with an optional comment.

**Why this is important for a defense explanation:**
- Timeline becomes an auditable record of **state transitions** and their justification.
- A timeline row captures:
  - `status_before`,
  - `status_after`,
  - operator comment (`content`),
  - timestamp (`created_at`),
  - and (optionally) `user_id`.

This is a clean and explainable structure that answers: *“what changed, who changed it, and why”*.

### 9.6 Why pagination and “per page” selector were added

Several pages can grow quickly (Incidents, Users, Organizations, Equipment, Hot Dashboard). We added:
- Pagination controls (Prev/Next + “X–Y of Z”),
- A “Per page” selector (5/10/25/50),
- Default page size = 10.

**Rationale:**
- Keeps pages usable on laptops and tablets,
- Prevents long tables from becoming cognitively overwhelming,
- Maintains performance by rendering only a slice of rows/cards.

**Implementation detail (data structure):**
- Pagination is implemented in the frontend using array slicing (`sliceForPage(list, page, pageSize)`).
- This is a classic *list windowing* approach that is simple, deterministic, and easy to explain academically.


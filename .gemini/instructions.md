# TEG CRM — Project Instructions

## Testing

- **Always run tests inside Podman containers**, never directly on the host.
- Use `podman compose` (not `docker compose`) for all container operations.
- Build and run: `podman compose up --build -d`
- Run Python tests: `podman exec teg-crm pytest`
- Run Next.js tests: `podman exec teg-crm-web npm test`

## Architecture

- **teg-crm-web**: Next.js 15 frontend, deployed via `output: "standalone"` Docker image.
- **teg-crm**: Django backend (Python), SQLite database persisted via Docker named volume.
- **AI Provider**: Google Gemini (`google-genai`). Do NOT use OpenAI or Anthropic.
- **Database**: SQLite at `/app/data/db.sqlite3`. Persisted via `crm-data` Docker volume.

## Deployment

- Target: Hetzner VPS with Coolify (Docker Compose).
- No Vercel. No serverless functions.
- SQLite database must survive container rebuilds (use named volumes).

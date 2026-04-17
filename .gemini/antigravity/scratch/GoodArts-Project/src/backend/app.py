"""
GoodArts — FastAPI Application Factory
Creates the app, mounts static files, runs startup migrations.
"""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from src.backend.database.migrations import run_migrations
from src.backend.api.routes import router
from src.backend.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup tasks: ensure DB schema is ready."""
    await run_migrations()
    yield


app = FastAPI(
    title="GoodArts",
    description="A local-first personal art companion.",
    version="0.2.0",
    lifespan=lifespan,
)

# -- API Routes ----------------------------------------------------------------
app.include_router(router, prefix="/api")

# -- Serve Frontend Static Files -----------------------------------------------
FRONTEND = settings.FRONTEND_DIR
app.mount("/static", StaticFiles(directory=str(FRONTEND)), name="static")

# -- Serve uploaded photos -----------------------------------------------------
uploads_dir = Path(str(settings.UPLOAD_DIR))
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

# -- Serve cached images -------------------------------------------------------
cache_dir = Path(str(settings.IMAGE_CACHE_DIR))
cache_dir.mkdir(parents=True, exist_ok=True)
app.mount("/cached-images", StaticFiles(directory=str(cache_dir)), name="cached-images")


@app.get("/", include_in_schema=False)
async def root():
    return FileResponse(str(FRONTEND / "index.html"))


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    return FileResponse(str(FRONTEND / "index.html"))

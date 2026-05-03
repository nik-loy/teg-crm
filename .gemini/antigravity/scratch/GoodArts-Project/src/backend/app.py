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


import asyncio
import aiosqlite
from src.backend.engine.dossier_worker import dossier_worker_loop

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup tasks: ensure DB schema is ready, start background workers."""
    await run_migrations()
    
    # Start the dossier worker
    async with aiosqlite.connect(str(settings.DB_PATH)) as db_conn:
        db_conn.row_factory = aiosqlite.Row
        await db_conn.execute("PRAGMA foreign_keys=ON")
        worker_task = asyncio.create_task(dossier_worker_loop(db_conn))
        
        yield
        
        # Shutdown
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            pass


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


# -- Serve manifest and service worker from root -------------------------------
@app.get("/manifest.json", include_in_schema=False)
async def get_manifest():
    return FileResponse(str(FRONTEND / "manifest.json"))


@app.get("/sw.js", include_in_schema=False)
async def get_sw():
    return FileResponse(str(FRONTEND / "sw.js"), media_type="application/javascript")


@app.get("/", include_in_schema=False)
async def root():
    return FileResponse(str(FRONTEND / "index.html"))


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    # If the path looks like a static file (has an extension), don't return index.html
    # This prevents MIME type errors for missing JS/CSS/images
    if "." in full_path.split("/")[-1]:
        from fastapi import HTTPException
        raise HTTPException(status_code=404)
    return FileResponse(str(FRONTEND / "index.html"))

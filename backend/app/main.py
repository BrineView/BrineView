"""BrineView FastAPI application."""
import logging
import os
import platform
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .deps import get_adapter, warm_adapter
from .routes.api import router as api_router
from .routes.auth import router as auth_router
from .routes.upload import router as upload_router

logger = logging.getLogger("brineview")

FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm-up must never kill the function: on serverless (read-only FS,
    # cold-start limits) a data problem should surface as a request-time
    # error, not a dead deployment. get_adapter() retries lazily per request.
    try:
        warm_adapter()
    except Exception:
        logger.exception("Data adapter warm-up failed; endpoints will retry lazily")
    yield


app = FastAPI(
    title="BrineView API",
    version="0.2.0",
    description="Interactive 3D Ocean Data Visualization",
    lifespan=lifespan,
)

# CORS for local dev (belt-and-suspenders; Vite proxy handles it in practice)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(auth_router)
app.include_router(upload_router)


@app.api_route("/", methods=["GET", "HEAD"])
def root():
    index = FRONTEND_DIST / "index.html"
    if index.is_file():
        return FileResponse(index)
    return {
        "service": "BrineView API",
        "version": "0.2.0",
        "status": "running",
    }


@app.get("/api/health")
def health() -> dict:
    """Liveness probe — no adapter, no static files, no disk I/O."""
    return {"status": "ok", "version": "0.2.0"}


@app.get("/api/diag")
def diag() -> dict:
    """Self-diagnostics for serverless deployments. Never raises."""
    data_dir = Path(__file__).resolve().parents[1] / "data"
    info: dict = {
        "version": "0.2.0",
        "python": platform.python_version(),
        "cwd": os.getcwd(),
        "frontend_index": (FRONTEND_DIST / "index.html").is_file(),
        "frontend_assets": (FRONTEND_DIST / "assets").is_dir(),
        "data_files": {
            name: (data_dir / name).is_file()
            for name in ("ocean_demo.nc", "bathymetry.nc", "floats.json")
        },
    }
    try:
        adapter = get_adapter()
        info["adapter"] = {"ok": True, "type": type(adapter).__name__}
    except Exception as e:  # noqa: BLE001 -- diagnostics must never 500
        info["adapter"] = {"ok": False, "error": f"{type(e).__name__}: {e}"}
    return info


if (FRONTEND_DIST / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

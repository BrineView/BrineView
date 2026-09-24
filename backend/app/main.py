"""BrineView FastAPI application."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .deps import warm_adapter
from .routes.api import router as api_router
from .routes.auth import router as auth_router
from .routes.upload import router as upload_router

FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

app = FastAPI(title="BrineView API", version="0.2.0", description="Interactive 3D Ocean Data Visualization")

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


@app.on_event("startup")
def _startup():
    warm_adapter()


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


if (FRONTEND_DIST / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

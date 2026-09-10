"""BrineView FastAPI application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes.api import router as api_router
from .routes.auth import router as auth_router

app = FastAPI(title="BrineView API", version="0.1.0", description="OceanLens 3D — Interactive 3D Ocean Data Visualization")

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


@app.get("/")
def root():
    return {
        "service": "BrineView API",
        "version": "0.1.0",
        "status": "running",
    }

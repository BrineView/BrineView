"""Build script for Vercel: compile the Vite frontend so FastAPI can serve it.

Vercel's Python runtime installs Python deps first, then runs
`[tool.vercel.scripts] build` from pyproject.toml before deploying.
The FastAPI app serves `frontend/dist` (see backend/app/main.py),
so this step must exist or `/` returns JSON instead of the UI.
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "frontend"


def run(*args: str) -> None:
    print(f"+ {' '.join(args)} (cwd={FRONTEND})", flush=True)
    subprocess.check_call(list(args), cwd=FRONTEND)


def main() -> None:
    if not (FRONTEND / "package.json").is_file():
        print("frontend/package.json not found, skipping frontend build.")
        return
    try:
        # npm ci is reproducible when package-lock.json is in sync
        run("npm", "ci")
    except subprocess.CalledProcessError:
        print("npm ci failed, falling back to npm install", flush=True)
        run("npm", "install")
    run("npm", "run", "build")
    dist = FRONTEND / "dist" / "index.html"
    if not dist.is_file():
        print("ERROR: frontend build did not produce dist/index.html", flush=True)
        sys.exit(1)
    print(f"Frontend build OK: {dist}", flush=True)


if __name__ == "__main__":
    main()

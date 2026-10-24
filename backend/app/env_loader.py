"""Environment loader with automatic fallback from .env to .env.example."""

from pathlib import Path
from dotenv import load_dotenv

def load_backend_env() -> None:
    # Check backend/.env then backend/.env.example
    base_dir = Path(__file__).resolve().parent.parent
    env_file = base_dir / ".env"
    example_file = base_dir / ".env.example"

    if env_file.exists():
        load_dotenv(env_file)
    elif example_file.exists():
        load_dotenv(example_file)
    else:
        load_dotenv()

load_backend_env()

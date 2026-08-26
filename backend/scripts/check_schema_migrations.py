from __future__ import annotations

from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory


BACKEND_DIR = Path(__file__).resolve().parents[1]


def migration_script() -> ScriptDirectory:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    return ScriptDirectory.from_config(config)


def validate_migration_graph(script: ScriptDirectory) -> str:
    heads = script.get_heads()
    if len(heads) != 1:
        raise RuntimeError(f"Expected one migration head, found {len(heads)}: {heads}")
    bases = script.get_bases()
    if len(bases) != 1:
        raise RuntimeError(f"Expected one migration base, found {len(bases)}: {bases}")
    if not tuple(script.walk_revisions()):
        raise RuntimeError("Expected at least one migration revision")
    return heads[0]


def main() -> None:
    head = validate_migration_graph(migration_script())
    print(f"Schema migration gate passed: head={head}")


if __name__ == "__main__":
    main()

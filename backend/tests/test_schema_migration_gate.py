from typing import cast
from unittest.mock import Mock

import pytest
from alembic.script import ScriptDirectory

from scripts.check_schema_migrations import migration_script, validate_migration_graph


def _script_with_graph(heads: list[str], bases: list[str], revisions: list[object]) -> ScriptDirectory:
    script = Mock(spec=ScriptDirectory)
    script.get_heads.return_value = heads
    script.get_bases.return_value = bases
    script.walk_revisions.return_value = iter(revisions)
    return cast(ScriptDirectory, script)


def test_repository_migration_graph_has_one_connected_head() -> None:
    script = migration_script()
    assert validate_migration_graph(script) == script.get_heads()[0]


def test_migration_gate_rejects_multiple_heads() -> None:
    script = _script_with_graph(["head_a", "head_b"], ["base"], [object()])
    with pytest.raises(RuntimeError, match="Expected one migration head"):
        validate_migration_graph(script)


def test_migration_gate_rejects_multiple_bases() -> None:
    script = _script_with_graph(["head"], ["base_a", "base_b"], [object()])
    with pytest.raises(RuntimeError, match="Expected one migration base"):
        validate_migration_graph(script)


def test_migration_gate_rejects_an_empty_graph() -> None:
    script = _script_with_graph(["head"], ["base"], [])
    with pytest.raises(RuntimeError, match="Expected at least one migration revision"):
        validate_migration_graph(script)

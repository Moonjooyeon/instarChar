from datetime import datetime, timezone

from sqlalchemy.dialects import postgresql

from app.repositories.users import UserRepository


def test_due_deletion_statement_uses_skip_locked() -> None:
    statement = UserRepository(object()).due_deletion_statement(datetime.now(timezone.utc), set())
    sql = str(statement.compile(dialect=postgresql.dialect()))
    assert "account_status" in sql
    assert "FOR UPDATE SKIP LOCKED" in sql

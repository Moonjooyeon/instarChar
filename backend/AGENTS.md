# Backend-local guidance

For FastAPI, PostgreSQL, authorization, migrations, AI services, storage, and backend tests, use `.agents/skills/alive-engineering-workflow/SKILL.md` and load only the reference for the current task mode.

Keep HTTP routing, schemas, services, repositories, and ORM models in their documented layers. Treat the database as the final authority for ownership, uniqueness, revision, and deletion rules. Never edit an applied migration or start the backend process during verification.

"""SQLAlchemy ORM model stubs.

The actual schema is managed by raw SQL in Alembic migrations
(see alembic/versions/001_initial_schema.py) to match ARCHITECTURE.md §3 exactly.

These models are provided for ORM queries in router handlers.
They are NOT used for table creation.

Note: pgSphere `spoint` columns are not directly representable in SQLAlchemy.
Use raw SQL or text() for spatial queries involving spoint.
"""

# Stub — ORM models will be implemented when router handlers are built.
# See ARCHITECTURE.md §3 for the full DDL.

"""Initial schema — matches ARCHITECTURE.md DDL.

Revision ID: 001
Revises: None
Create Date: 2026-10-11
"""
from typing import Sequence, Union

from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -- Extensions
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_sphere")

    # -- Enum types
    op.execute("""
        CREATE TYPE user_role AS ENUM ('volunteer', 'astronomer', 'admin')
    """)
    op.execute("""
        CREATE TYPE classification_category AS ENUM (
            'asteroid_neo', 'comet', 'brown_dwarf',
            'planet_x_candidate', 'artifact', 'nothing'
        )
    """)
    op.execute("""
        CREATE TYPE candidate_status AS ENUM (
            'new', 'under_review', 'confirmed', 'rejected'
        )
    """)
    op.execute("""
        CREATE TYPE ingest_job_status AS ENUM (
            'queued', 'running', 'completed', 'failed'
        )
    """)

    # -- users
    op.execute("""
        CREATE TABLE users (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            display_name    VARCHAR(100) NOT NULL,
            email           VARCHAR(255) UNIQUE,
            oauth_provider  VARCHAR(20),
            oauth_sub       VARCHAR(255),
            role            user_role NOT NULL DEFAULT 'volunteer',
            reliability     FLOAT NOT NULL DEFAULT 0.5
                CHECK (reliability >= 0.0 AND reliability <= 1.0),
            gold_total      INT NOT NULL DEFAULT 0,
            gold_correct    INT NOT NULL DEFAULT 0,
            classification_count INT NOT NULL DEFAULT 0,
            tutorial_completed BOOLEAN NOT NULL DEFAULT FALSE,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE UNIQUE INDEX idx_users_oauth
            ON users (oauth_provider, oauth_sub)
            WHERE oauth_provider IS NOT NULL
    """)

    # -- subjects
    op.execute("""
        CREATE TABLE subjects (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            position        spoint NOT NULL,
            ra_deg          FLOAT NOT NULL,
            dec_deg         FLOAT NOT NULL,
            size_deg        FLOAT NOT NULL DEFAULT 0.1,
            epochs          INT[] NOT NULL,
            tile_urls       JSONB NOT NULL,
            is_gold_standard BOOLEAN NOT NULL DEFAULT FALSE,
            gold_expected   JSONB,
            mask_fraction   FLOAT,
            retired         BOOLEAN NOT NULL DEFAULT FALSE,
            classification_count INT NOT NULL DEFAULT 0,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX idx_subjects_position
            ON subjects USING GIST (position)
    """)
    op.execute("""
        CREATE INDEX idx_subjects_queue
            ON subjects (is_gold_standard, created_at)
            WHERE retired = FALSE
    """)

    # -- classifications
    op.execute("""
        CREATE TABLE classifications (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id         UUID NOT NULL REFERENCES users(id),
            subject_id      UUID NOT NULL REFERENCES subjects(id),
            category        classification_category NOT NULL,
            submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            load_time_ms    INT,
            user_reliability_at_submission FLOAT NOT NULL,
            UNIQUE (user_id, subject_id)
        )
    """)
    op.execute("""
        CREATE INDEX idx_classifications_subject
            ON classifications (subject_id)
    """)
    op.execute("""
        CREATE INDEX idx_classifications_user
            ON classifications (user_id)
    """)

    # -- marks
    op.execute("""
        CREATE TABLE marks (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            classification_id UUID NOT NULL REFERENCES classifications(id) ON DELETE CASCADE,
            epoch           INT NOT NULL,
            pixel_x         FLOAT NOT NULL,
            pixel_y         FLOAT NOT NULL,
            ra_deg          FLOAT NOT NULL,
            dec_deg         FLOAT NOT NULL,
            position        spoint NOT NULL,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX idx_marks_classification
            ON marks (classification_id)
    """)
    op.execute("""
        CREATE INDEX idx_marks_subject_epoch
            ON marks (classification_id, epoch)
    """)

    # -- candidates
    op.execute("""
        CREATE TABLE candidates (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            subject_id      UUID NOT NULL REFERENCES subjects(id),
            category        classification_category NOT NULL,
            status          candidate_status NOT NULL DEFAULT 'new',
            n_classifications INT NOT NULL,
            mean_reliability FLOAT NOT NULL,
            cluster_dispersion_arcsec FLOAT,
            motion_arcsec_per_epoch FLOAT,
            motion_pa_deg   FLOAT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX idx_candidates_status ON candidates (status)
    """)
    op.execute("""
        CREATE INDEX idx_candidates_subject ON candidates (subject_id)
    """)

    # -- candidate_epochs
    op.execute("""
        CREATE TABLE candidate_epochs (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            candidate_id    UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
            epoch           INT NOT NULL,
            centroid_ra_deg FLOAT NOT NULL,
            centroid_dec_deg FLOAT NOT NULL,
            centroid_position spoint NOT NULL,
            cluster_size    INT NOT NULL,
            dispersion_arcsec FLOAT NOT NULL,
            UNIQUE (candidate_id, epoch)
        )
    """)
    op.execute("""
        CREATE INDEX idx_candidate_epochs_candidate
            ON candidate_epochs (candidate_id)
    """)

    # -- candidate_reviews
    op.execute("""
        CREATE TABLE candidate_reviews (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            candidate_id    UUID NOT NULL REFERENCES candidates(id),
            reviewer_id     UUID NOT NULL REFERENCES users(id),
            old_status      candidate_status NOT NULL,
            new_status      candidate_status NOT NULL,
            rationale       TEXT,
            reviewed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX idx_candidate_reviews_candidate
            ON candidate_reviews (candidate_id)
    """)

    # -- badges
    op.execute("""
        CREATE TABLE badges (
            id              VARCHAR(50) PRIMARY KEY,
            display_name    VARCHAR(100) NOT NULL,
            description     TEXT NOT NULL,
            icon_url        VARCHAR(500),
            threshold       INT
        )
    """)
    op.execute("""
        INSERT INTO badges (id, display_name, description, threshold) VALUES
            ('first_classify',    'First Light',        'Submit your first classification.',           1),
            ('classify_10',       'Sharp Eyes',         'Submit 10 classifications.',                  10),
            ('classify_50',       'Asteroid Hunter',    'Submit 50 classifications.',                  50),
            ('classify_100',      'Comet Chaser',       'Submit 100 classifications.',                 100),
            ('classify_500',      'Deep Sky Surveyor',  'Submit 500 classifications.',                 500),
            ('gold_hit',          'Bullseye',           'Correctly identify a gold-standard object.',   NULL),
            ('streak_7',          'Week Warrior',       'Classify on 7 consecutive days.',              7)
    """)

    # -- user_badges
    op.execute("""
        CREATE TABLE user_badges (
            user_id         UUID NOT NULL REFERENCES users(id),
            badge_id        VARCHAR(50) NOT NULL REFERENCES badges(id),
            earned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (user_id, badge_id)
        )
    """)

    # -- ingest_jobs
    op.execute("""
        CREATE TABLE ingest_jobs (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            ra_deg          FLOAT NOT NULL,
            dec_deg         FLOAT NOT NULL,
            size_deg        FLOAT NOT NULL DEFAULT 0.1,
            status          ingest_job_status NOT NULL DEFAULT 'queued',
            subject_id      UUID REFERENCES subjects(id),
            error_message   TEXT,
            retries         INT NOT NULL DEFAULT 0,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX idx_ingest_jobs_status
            ON ingest_jobs (status)
            WHERE status IN ('queued', 'running')
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ingest_jobs CASCADE")
    op.execute("DROP TABLE IF EXISTS user_badges CASCADE")
    op.execute("DROP TABLE IF EXISTS badges CASCADE")
    op.execute("DROP TABLE IF EXISTS candidate_reviews CASCADE")
    op.execute("DROP TABLE IF EXISTS candidate_epochs CASCADE")
    op.execute("DROP TABLE IF EXISTS candidates CASCADE")
    op.execute("DROP TABLE IF EXISTS marks CASCADE")
    op.execute("DROP TABLE IF EXISTS classifications CASCADE")
    op.execute("DROP TABLE IF EXISTS subjects CASCADE")
    op.execute("DROP TABLE IF EXISTS users CASCADE")
    op.execute("DROP TYPE IF EXISTS ingest_job_status")
    op.execute("DROP TYPE IF EXISTS candidate_status")
    op.execute("DROP TYPE IF EXISTS classification_category")
    op.execute("DROP TYPE IF EXISTS user_role")
    op.execute("DROP EXTENSION IF EXISTS pg_sphere")

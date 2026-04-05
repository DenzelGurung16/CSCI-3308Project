CREATE TABLE IF NOT EXISTS worksites (
    id         SERIAL       PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    address    TEXT,
    city       VARCHAR(100),
    state      VARCHAR(50),
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL       PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'worker'
                      CHECK (role IN ('admin', 'manager', 'worker')),
    worksite_id   INT          REFERENCES worksites(id) ON DELETE SET NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);
 
CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_worksite ON users(worksite_id);

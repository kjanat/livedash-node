-- Migration: Create Auth.js v5 tables for D1 adapter
-- Auth.js v5 requires these specific table names and schemas
-- Users table for Auth.js
-- Note: This is separate from our existing User table
CREATE TABLE
    IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT,
        email TEXT UNIQUE,
        email_verified INTEGER,
        image TEXT
    );

-- Accounts table for OAuth providers
CREATE TABLE
    IF NOT EXISTS accounts (
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        provider TEXT NOT NULL,
        provider_account_id TEXT NOT NULL,
        refresh_token TEXT,
        access_token TEXT,
        expires_at INTEGER,
        token_type TEXT,
        scope TEXT,
        id_token TEXT,
        session_state TEXT,
        PRIMARY KEY (provider, provider_account_id),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

-- Sessions table for session management
CREATE TABLE
    IF NOT EXISTS sessions (
        session_token TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        expires INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

-- Verification tokens for email verification and magic links
CREATE TABLE
    IF NOT EXISTS verification_tokens (
        identifier TEXT NOT NULL,
        token TEXT NOT NULL,
        expires INTEGER NOT NULL,
        PRIMARY KEY (identifier, token)
    );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts (user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires);

CREATE INDEX IF NOT EXISTS idx_verification_tokens_identifier ON verification_tokens (identifier);

CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens (token);

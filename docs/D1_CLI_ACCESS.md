# D1 Database Command Line Access

This guide shows you how to access and manage your Cloudflare D1 database `d1-notso-livedash` from the command line.

## Quick Reference

### Using the Custom D1 CLI Script

```bash
# Simple and fast commands
pnpm d1 tables                           # List all tables
pnpm d1 info                             # Database information
pnpm d1 schema User                      # Show table schema
pnpm d1 query "SELECT COUNT(*) FROM User" # Execute SQL
pnpm d1 export backup.sql               # Export database

# Remote (production) commands
pnpm d1 --remote info                   # Production database info
pnpm d1 --remote query "SELECT * FROM Company LIMIT 5"
```

### Using Package.json Scripts

```bash
# Database information
pnpm d1:list                # List all D1 databases
pnpm d1:info                # Local database info
pnpm d1:info:remote         # Remote database info

# Backup and export
pnpm d1:export              # Export local database
pnpm d1:export:remote       # Export remote database
pnpm d1:schema              # Export schema only
```

### Direct Wrangler Commands

```bash
# Basic operations
npx wrangler d1 list
npx wrangler d1 info d1-notso-livedash
npx wrangler d1 execute d1-notso-livedash --command "SELECT * FROM User"

# Remote operations (add --remote flag)
npx wrangler d1 info d1-notso-livedash --remote
npx wrangler d1 execute d1-notso-livedash --remote --command "SELECT COUNT(*) FROM Company"
```

## Database Schema

Your D1 database contains these tables:

### Company Table

```sql
- id (TEXT, PRIMARY KEY)
- name (TEXT, NOT NULL)
- csvUrl (TEXT, NOT NULL)
- csvUsername (TEXT)
- csvPassword (TEXT)
- sentimentAlert (REAL)
- dashboardOpts (TEXT)
- createdAt (DATETIME, NOT NULL, DEFAULT CURRENT_TIMESTAMP)
- updatedAt (DATETIME, NOT NULL)
```

### User Table

```sql
- id (TEXT, PRIMARY KEY)
- email (TEXT, NOT NULL)
- password (TEXT, NOT NULL)
- companyId (TEXT, NOT NULL)
- role (TEXT, NOT NULL)
- resetToken (TEXT)
- resetTokenExpiry (DATETIME)
```

### Session Table

```sql
- id (TEXT, PRIMARY KEY)
- userId (TEXT, NOT NULL)
- expiresAt (DATETIME, NOT NULL)
```

## Common SQL Queries

### Data Exploration

```sql
-- Check table sizes
SELECT 'Company' as table_name, COUNT(*) as count FROM Company
UNION ALL
SELECT 'User' as table_name, COUNT(*) as count FROM User
UNION ALL
SELECT 'Session' as table_name, COUNT(*) as count FROM Session;

-- Show all table names
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;

-- Get table schema
PRAGMA table_info(User);
```

### Business Queries

```sql
-- List companies with user counts
SELECT c.name, c.id, COUNT(u.id) as user_count
FROM Company c
LEFT JOIN User u ON c.id = u.companyId
GROUP BY c.id, c.name;

-- Find admin users
SELECT u.email, c.name as company
FROM User u
JOIN Company c ON u.companyId = c.id
WHERE u.role = 'admin';

-- Active sessions
SELECT COUNT(*) as active_sessions
FROM Session
WHERE expiresAt > datetime('now');
```

## Local vs Remote Databases

- **Local Database**: Located at `.wrangler/state/v3/d1/` (for development)
- **Remote Database**: Cloudflare's production D1 database

### When to Use Each:

- **Local**: Development, testing, safe experimentation
- **Remote**: Production data, deployment verification

## Database Statistics

Current database info:

- **Database ID**: d4ee7efe-d37a-48e4-bed7-fdfaa5108131
- **Region**: WEUR (Western Europe)
- **Size**: ~53.2 kB
- **Tables**: 6 (including system tables)
- **Read Queries (24h)**: 65
- **Write Queries (24h)**: 8

## Scripts Available

### `/scripts/d1.js` (Recommended)

Simple, fast CLI for common operations:

```bash
node scripts/d1.js tables
node scripts/d1.js schema User
node scripts/d1.js query "SELECT * FROM Company"
node scripts/d1.js --remote info
```

### `/scripts/d1-query.js`

Simple query executor:

```bash
node scripts/d1-query.js "SELECT COUNT(*) FROM User"
node scripts/d1-query.js --remote "SELECT * FROM Company"
```

### `/scripts/d1-manager.js`

Comprehensive database management (if needed for advanced operations):

```bash
node scripts/d1-manager.js info
node scripts/d1-manager.js backup
```

## Backup and Recovery

### Create Backups

```bash
# Quick backup
pnpm d1 export backup_$(date +%Y%m%d).sql

# Automated backup with timestamp
npx wrangler d1 export d1-notso-livedash --output backups/backup_$(date +%Y%m%d_%H%M%S).sql

# Schema only backup
npx wrangler d1 export d1-notso-livedash --no-data --output schema.sql
```

### Restore from Backup

```bash
# Apply SQL file to database
npx wrangler d1 execute d1-notso-livedash --file backup.sql
```

## Troubleshooting

### Common Issues

1. **"wrangler not found"**: Use `npx wrangler` instead of `wrangler`
2. **Permission denied**: Ensure you're logged into Cloudflare: `npx wrangler login`
3. **Database not found**: Check `wrangler.json` for correct binding name

### Debug Commands

```bash
# Check Wrangler authentication
npx wrangler whoami

# Verify database configuration
npx wrangler d1 list

# Test database connectivity
npx wrangler d1 execute d1-notso-livedash --command "SELECT 1"
```

## Security Notes

- Local database is for development only
- Never expose production database credentials
- Use `--remote` flag carefully in production
- Regular backups are recommended for production data

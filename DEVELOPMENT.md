# LiveDash-Node Development Guide

## Simplified Development Setup

This project has been simplified to use **ONE environment** for local development to avoid confusion.

### Quick Start

1. **Start Development Server**

   ```bash
   pnpm run dev
   ```

   This starts Next.js on http://localhost:3000 with full authentication and dashboard.

2. **Login Credentials**
   - Email: `admin@example.com`
   - Password: `admin123`

### Development vs Production

- **Development**: `pnpm run dev` - Next.js app using local D1 database
- **Production**: Cloudflare Workers with remote D1 database

### Environment Files

- `.env.local` - Local development (Next.js)
- `.dev.vars` - Cloudflare Workers development (only needed for `pnpm run dev:cf`)

### Database

- **Local Development**: Uses the same D1 database that Wrangler creates locally
- **Production**: Uses remote Cloudflare D1 database

### Key Commands

```bash
# Start development (recommended)
pnpm run dev

# Test Cloudflare Workers deployment locally (optional)
pnpm run dev:cf

# Deploy to production
pnpm run deploy

# Database migrations
pnpm run seedLocalD1    # Apply migrations to local D1
pnpm run predeploy      # Apply migrations to remote D1
```

### Auth.js v5 Migration Complete

✅ Migrated from NextAuth v4 to Auth.js v5  
✅ Updated all API routes and authentication flows  
✅ Configured for both development and production environments  
✅ Using Cloudflare D1 database with proper Auth.js v5 tables

### Troubleshooting

- If login doesn't work, ensure the local D1 database is set up: `pnpm run seedLocalD1`
- If you see CSRF errors, try using Chrome instead of VS Code's browser
- For any auth issues, check the console logs and verify environment variables

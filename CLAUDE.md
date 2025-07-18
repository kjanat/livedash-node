# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Core Development:**

- `pnpm dev` - Start development server (runs custom server.ts with schedulers)
- `pnpm dev:next-only` - Start Next.js only with Turbopack (no schedulers)
- `pnpm build` - Build production application
- `pnpm start` - Run production server

**Code Quality:**

- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint issues automatically
- `pnpm format` - Format code with Prettier
- `pnpm format:check` - Check formatting without fixing

**Database:**

- `pnpm prisma:generate` - Generate Prisma client
- `pnpm prisma:migrate` - Run database migrations
- `pnpm prisma:push` - Push schema changes to database
- `pnpm prisma:push:force` - Force reset database and push schema
- `pnpm prisma:seed` - Seed database with initial data
- `pnpm prisma:studio` - Open Prisma Studio database viewer

**Testing:**

- `pnpm test` - Run both Vitest and Playwright tests concurrently
- `pnpm test:vitest` - Run Vitest tests only
- `pnpm test:vitest:watch` - Run Vitest in watch mode
- `pnpm test:vitest:coverage` - Run Vitest with coverage report
- `pnpm test:coverage` - Run all tests with coverage

**Markdown:**

- `pnpm lint:md` - Lint Markdown files
- `pnpm lint:md:fix` - Fix Markdown linting issues

## Architecture Overview

**LiveDash-Node** is a real-time analytics dashboard for monitoring user sessions with AI-powered analysis and processing pipeline.

### Tech Stack

- **Frontend:** Next.js 15 + React 19 + TailwindCSS 4
- **Backend:** Next.js API Routes + Custom Node.js server
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** NextAuth.js
- **AI Processing:** OpenAI API integration
- **Visualization:** D3.js, React Leaflet, Recharts
- **Scheduling:** Node-cron for background processing

### Key Architecture Components

**1. Multi-Stage Processing Pipeline**
The system processes user sessions through distinct stages tracked in `SessionProcessingStatus`:

- `CSV_IMPORT` - Import raw CSV data into `SessionImport`
- `TRANSCRIPT_FETCH` - Fetch transcript content from URLs
- `SESSION_CREATION` - Create normalized `Session` and `Message` records
- `AI_ANALYSIS` - AI processing for sentiment, categorization, summaries
- `QUESTION_EXTRACTION` - Extract questions from conversations

**2. Database Architecture**

- **Multi-tenant design** with `Company` as root entity
- **Dual storage pattern**: Raw CSV data in `SessionImport`, processed data in `Session`
- **1-to-1 relationship** between `SessionImport` and `Session` via `importId`
- **Message parsing** into individual `Message` records with order tracking
- **AI cost tracking** via `AIProcessingRequest` with detailed token usage
- **Flexible AI model management** through `AIModel`, `AIModelPricing`, and `CompanyAIModel`

**3. Custom Server Architecture**

- `server.ts` - Custom Next.js server with configurable scheduler initialization
- Three main schedulers: CSV import, import processing, and session processing
- Environment-based configuration via `lib/env.ts`

**4. Key Processing Libraries**

- `lib/scheduler.ts` - CSV import scheduling
- `lib/importProcessor.ts` - Raw data to Session conversion
- `lib/processingScheduler.ts` - AI analysis pipeline
- `lib/transcriptFetcher.ts` - External transcript fetching
- `lib/transcriptParser.ts` - Message parsing from transcripts

### Development Environment

**Environment Configuration:**
Environment variables are managed through `lib/env.ts` with .env.local file support:

- Database: PostgreSQL via `DATABASE_URL` and `DATABASE_URL_DIRECT`
- Authentication: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- AI Processing: `OPENAI_API_KEY`
- Schedulers: `SCHEDULER_ENABLED`, various interval configurations

**Key Files to Understand:**

- `prisma/schema.prisma` - Complete database schema with enums and relationships
- `server.ts` - Custom server entry point
- `lib/env.ts` - Environment variable management and validation
- `app/` - Next.js App Router structure

**Testing:**

- Uses Vitest for unit testing
- Playwright for E2E testing
- Test files in `tests/` directory

### Important Notes

**Scheduler System:**

- Schedulers are optional and controlled by `SCHEDULER_ENABLED` environment variable
- Use `pnpm dev:next-only` to run without schedulers for pure frontend development
- Three separate schedulers handle different pipeline stages:
  - CSV Import Scheduler (`lib/scheduler.ts`)
  - Import Processing Scheduler (`lib/importProcessor.ts`)
  - Session Processing Scheduler (`lib/processingScheduler.ts`)

**Database Migrations:**

- Always run `pnpm prisma:generate` after schema changes
- Use `pnpm prisma:migrate` for production-ready migrations
- Use `pnpm prisma:push` for development schema changes
- Database uses PostgreSQL with Prisma's driver adapter for connection pooling

**AI Processing:**

- All AI requests are tracked for cost analysis
- Support for multiple AI models per company
- Time-based pricing management for accurate cost calculation
- Processing stages can be retried on failure with retry count tracking

**Code Quality Standards:**

- Run `pnpm lint` and `pnpm format:check` before committing
- TypeScript with ES modules (type: "module" in package.json)
- React 19 with Next.js 15 App Router
- TailwindCSS 4 for styling

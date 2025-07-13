# LiveDash-Node

A comprehensive real-time analytics dashboard for monitoring user sessions with AI-powered analysis, enterprise-grade security features, and advanced processing pipeline.

![Next.js](<https://img.shields.io/badge/dynamic/regex?url=https%3A%2F%2Fraw.githubusercontent.com%2Fkjanat%2Flivedash-node%2Fmaster%2Fpackage.json&search=%22next%22%5Cs*%3A%5Cs*%22%5C%5E(%3F%3Cversion%3E%5Cd%2B%5C.%5Cd*).*%22&replace=%24%3Cversion%3E&logo=nextdotjs&label=Nextjs&color=%23000000>)
![React](<https://img.shields.io/badge/dynamic/regex?url=https%3A%2F%2Fraw.githubusercontent.com%2Fkjanat%2Flivedash-node%2Fmaster%2Fpackage.json&search=%22react%22%5Cs*%3A%5Cs*%22%5C%5E(%3F%3Cversion%3E%5Cd%2B%5C.%5Cd*).*%22&replace=%24%3Cversion%3E&logo=react&label=React&color=%2361DAFB>)
![TypeScript](<https://img.shields.io/badge/dynamic/regex?url=https%3A%2F%2Fraw.githubusercontent.com%2Fkjanat%2Flivedash-node%2Fmaster%2Fpackage.json&search=%22typescript%22%5Cs*%3A%5Cs*%22%5C%5E(%3F%3Cversion%3E%5Cd%2B%5C.%5Cd*).*%22&replace=%24%3Cversion%3E&logo=typescript&label=TypeScript&color=%233178C6>)
![Prisma](<https://img.shields.io/badge/dynamic/regex?url=https%3A%2F%2Fraw.githubusercontent.com%2Fkjanat%2Flivedash-node%2Fmaster%2Fpackage.json&search=%22prisma%22%5Cs*%3A%5Cs*%22%5C%5E(%3F%3Cversion%3E%5Cd%2B%5C.%5Cd*).*%22&replace=%24%3Cversion%3E&logo=prisma&label=Prisma&color=%232D3748>)
![TailwindCSS](<https://img.shields.io/badge/dynamic/regex?url=https%3A%2F%2Fraw.githubusercontent.com%2Fkjanat%2Flivedash-node%2Fmaster%2Fpackage.json&search=%22tailwindcss%22%5Cs*%3A%5Cs*%22%5C%5E(%3F%3Cversion%3E%5Cd%2B%5C.%5Cd*).*%22&replace=%24%3Cversion%3E&logo=tailwindcss&label=TailwindCSS&color=%2306B6D4>)

## Features

### Core Analytics

- **Real-time Session Monitoring**: Track and analyze user sessions as they happen
- **Interactive Visualizations**: Geographic maps, response time distributions, and advanced charts
- **AI-Powered Analysis**: OpenAI integration with 50% cost reduction through batch processing
- **Advanced Analytics**: Detailed metrics and insights about user behavior patterns
- **Session Details**: In-depth analysis of individual user sessions with transcript parsing

### Security & Admin Features

- **Enterprise Security**: Multi-layer security with CSRF protection, CSP, and rate limiting
- **Security Monitoring**: Real-time threat detection and alerting system
- **Audit Logging**: Comprehensive security audit trails with retention management
- **Admin Dashboard**: Advanced administration tools for user and system management
- **Geographic Threat Detection**: IP-based threat analysis and anomaly detection

### Platform Management

- **Multi-tenant Architecture**: Company-based data isolation and management
- **User Management**: Role-based access control with platform admin capabilities
- **Batch Processing**: Optimized AI processing pipeline with automated scheduling
- **Data Export**: CSV/JSON export capabilities for analytics and audit data

## Tech Stack

- **Frontend**: React 19, Next.js 15, TailwindCSS 4
- **Backend**: Next.js API Routes, tRPC, Custom Node.js server
- **Database**: PostgreSQL with Prisma ORM and connection pooling
- **Authentication**: NextAuth.js with enhanced security features
- **Security**: CSRF protection, CSP with nonce-based scripts, comprehensive rate limiting
- **AI Processing**: OpenAI API with batch processing for cost optimization
- **Visualization**: D3.js, React Leaflet, Recharts, custom chart components
- **Monitoring**: Real-time security monitoring, audit logging, threat detection
- **Data Processing**: Node-cron schedulers for automated batch processing and AI analysis

## Getting Started

### Prerequisites

- Node.js 18+ (LTS version recommended)
- pnpm (recommended package manager)
- PostgreSQL 13+ database

### Installation

1.  Clone this repository:

```bash
git clone https://github.com/kjanat/livedash-node.git
cd livedash-node
```

2.  Install dependencies:

```bash
pnpm install
```

3.  Set up environment variables:

```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

4.  Set up the database:

```bash
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
```

5.  Start the development server:

```bash
pnpm dev
```

6.  Open your browser and navigate to <http://localhost:3000>

## Environment Setup

Create a `.env.local` file in the root directory with the following variables:

```env
# Database Configuration
DATABASE_URL="postgresql://user:password@localhost:5432/livedash"
DATABASE_URL_DIRECT="postgresql://user:password@localhost:5432/livedash"

# Authentication
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret-key"

# AI Processing (optional - for AI features)
OPENAI_API_KEY="your-openai-api-key"

# Security Configuration
CSRF_SECRET="your-csrf-secret-key"

# Scheduler Configuration (optional)
SCHEDULER_ENABLED="true"
CSV_IMPORT_INTERVAL="*/10 * * * *"
IMPORT_PROCESSING_INTERVAL="*/5 * * * *"
SESSION_PROCESSING_INTERVAL="*/2 * * * *"
BATCH_PROCESSING_INTERVAL="*/1 * * * *"

# Batch Processing (optional)
BATCH_PROCESSING_ENABLED="true"
BATCH_CREATE_INTERVAL="*/5 * * * *"
BATCH_STATUS_CHECK_INTERVAL="*/2 * * * *"
BATCH_RESULT_PROCESSING_INTERVAL="*/1 * * * *"
```

## Project Structure

- `app/`: Next.js App Router pages and API routes
  - `api/`: API endpoints including admin, security, and tRPC routes
  - `dashboard/`: Main analytics dashboard pages
  - `platform/`: Platform administration interface
- `components/`: Reusable React components
  - `admin/`: Administrative dashboard components
  - `security/`: Security monitoring UI components
  - `forms/`: CSRF-protected forms and form utilities
  - `providers/`: Context providers (CSRF, tRPC, themes)
- `lib/`: Core utilities and business logic
  - Security modules (CSRF, CSP, rate limiting, audit logging)
  - Processing pipelines (batch processing, AI analysis)
  - Database utilities and authentication
- `server/`: tRPC server configuration and routers
- `prisma/`: Database schema, migrations, and seed scripts
- `tests/`: Comprehensive test suite (unit, integration, E2E)
- `docs/`: Detailed project documentation
- `scripts/`: Migration and utility scripts

## Available Scripts

### Development

- `pnpm dev`: Start development server with all features
- `pnpm dev:next-only`: Start Next.js only (no background schedulers)
- `pnpm build`: Build the application for production
- `pnpm start`: Run the production build

### Code Quality

- `pnpm lint`: Run ESLint
- `pnpm lint:fix`: Fix ESLint issues automatically
- `pnpm format`: Format code with Prettier
- `pnpm format:check`: Check code formatting

### Database

- `pnpm prisma:studio`: Open Prisma Studio to view database
- `pnpm prisma:migrate`: Run database migrations
- `pnpm prisma:generate`: Generate Prisma client
- `pnpm prisma:seed`: Seed database with test data

### Testing

- `pnpm test`: Run all tests (Vitest + Playwright)
- `pnpm test:vitest`: Run unit and integration tests
- `pnpm test:coverage`: Run tests with coverage reports
- `pnpm test:security`: Run security-specific tests
- `pnpm test:csp`: Test CSP implementation

### Security & Migration

- `pnpm migration:backup`: Create database backup
- `pnpm migration:health-check`: Run system health checks
- `pnpm test:security-headers`: Test HTTP security headers

## Contributing

1.  Fork the repository
2.  Create your feature branch: `git checkout -b feature/my-new-feature`
3.  Commit your changes: `git commit -am 'Add some feature'`
4.  Push to the branch: `git push origin feature/my-new-feature`
5.  Submit a pull request

## License

This project is not licensed for commercial use without explicit permission. Free to use for educational or personal projects.

## Acknowledgments

- [Next.js](https://nextjs.org/)
- [Prisma](https://prisma.io/)
- [TailwindCSS](https://tailwindcss.com/)
- [Chart.js](https://www.chartjs.org/)
- [D3.js](https://d3js.org/)
- [React Leaflet](https://react-leaflet.js.org/)

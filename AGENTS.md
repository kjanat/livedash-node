# LiveDash-Node AGENTS.md

This document provides a comprehensive overview of the LiveDash-Node project, including its architecture, key components, and operational procedures.

## Project Overview

LiveDash-Node is a multi-tenant dashboard system designed for tracking and analyzing chat session metrics. It provides a web-based interface for users to monitor key performance indicators, review chat transcripts, and gain insights into customer interactions. The system is built with a modern technology stack, featuring a Next.js frontend, a Node.js backend, and a Prisma ORM for database interactions.

### Core Features

- **Multi-tenant architecture:** Supports multiple companies, each with its own isolated data and dashboard configurations.
- **Automated data fetching:** Periodically fetches chat session data from external CSV files.
- **Data processing and analysis:** Parses and enriches raw session data, calculating metrics such as sentiment, response times, and token usage.
- **Interactive dashboards:** Visualizes key metrics through a variety of charts and graphs, including geographic maps, donut charts, and time-series data.
- **Session-level details:** Allows users to drill down into individual chat sessions to view full transcripts and detailed metadata.
- **User authentication and authorization:** Implements a secure login system with role-based access control.

## Technical Architecture

The application is a full-stack TypeScript project built on the Next.js framework. It uses a custom server to integrate scheduled tasks for data fetching and processing.

### Technology Stack

- **Frontend:**
  - Next.js (React framework)
  - TypeScript
  - Tailwind CSS (styling)
  - Chart.js, D3.js (data visualization)
  - Leaflet.js (maps)
- **Backend:**
  - Node.js
  - Next.js API Routes
  - Prisma (ORM)
  - SQLite (database)
- **Authentication:**
  - NextAuth.js
- **Testing:**
  - Playwright (end-to-end testing)
- **Linting and Formatting:**
  - ESLint
  - Prettier
  - markdownlint

### Project Structure

The project is organized into the following key directories:

- `app/`: Contains the main application code, including pages, layouts, and UI components.
- `components/`: Reusable React components used throughout the application.
- `lib/`: Core application logic, including data fetching, processing, and utility functions.
- `pages/api/`: Next.js API routes for handling backend requests.
- `prisma/`: Database schema, migrations, and seed scripts.
- `public/`: Static assets such as images and fonts.
- `scripts/`: Standalone scripts for various development and operational tasks.

## Key Components

### Data Fetching and Processing

The system uses a two-stage process for handling chat session data:

1.  **Fetching:** The `lib/scheduler.ts` module defines a cron job that periodically fetches new session data from a CSV file specified for each company.
2.  **Processing:** The `lib/processingScheduler.ts` module defines a second cron job that processes the fetched data. This includes:
    - Parsing the CSV data.
    - Enriching the data with additional information (e.g., sentiment analysis, geographic location).
    - Storing the processed data in the database.

### Database Schema

The database schema is defined in `prisma/schema.prisma` and consists of the following models:

- `Company`: Represents a tenant in the system.
- `User`: Represents a user with access to the system.
- `Session`: Represents a single chat session.
- `Message`: Represents a single message within a chat session.

### API Endpoints

The application exposes a set of API endpoints for handling various client-side requests. These are defined in the `pages/api/` directory and include endpoints for:

- User authentication (login, registration, password reset).
- Dashboard data (metrics, sessions, users).
- Administrative tasks (triggering data processing).

## Operational Procedures

### Local Development

To run the application in a local development environment, follow these steps:

1.  Install the dependencies:
    ```bash
    npm install
    ```
2.  Initialize the database:
    ```bash
    npx prisma migrate dev
    npx prisma db seed
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```

### Running with Schedulers

To run the development server with the data fetching and processing schedulers enabled, use the following command:

```bash
npm run dev:with-schedulers
```

### Linting and Formatting

The project uses ESLint and Prettier for code linting and formatting. The following commands are available:

- `npm run lint`: Check for linting errors.
- `npm run lint:fix`: Automatically fix linting errors.
- `npm run format`: Format the code using Prettier.
- `npm run format:check`: Check for formatting errors.

### Testing

The project uses Playwright for end-to-end testing. To run the tests, use the following command:

```bash
npx playwright test
```

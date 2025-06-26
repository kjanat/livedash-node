# Project Overview

This project is a Next.js application with a Node.js backend, designed to provide a live dashboard for data visualization and session management.

## Setup

To set up the project, follow these steps:

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Environment Variables:**
    Create a `.env` file based on `.env.example` and fill in the necessary environment variables.

3.  **Database Setup:**
    Run database migrations:
    ```bash
    npx prisma migrate dev
    ```
    Seed the database (optional):
    ```bash
    npx prisma db seed
    ```

4.  **Run Development Server:**
    ```bash
    npm run dev
    ```

## Common Commands

-   **Run Tests:**
    ```bash
    npm test
    ```

-   **Run Linter:**
    ```bash
    npm run lint
    ```

-   **Build Project:**
    ```bash
    npm run build
    ```

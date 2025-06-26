# TODO.md

# Refactor!!!

> Based on my analysis of the codebase, here is a plan with recommendations for improving the project. The focus is on enhancing standardization, abstraction, user experience, and visual
  design.

## High-Level Recommendations

The project has a solid foundation, but it could be significantly improved by focusing on three key areas:

1. Adopt a UI Component Library: While Tailwind CSS is excellent for styling, using a component library like ShadCN/UI or Headless UI would provide pre-built, accessible, and visually
   consistent components, saving development time and improving the user experience.
2. Refactor for Next.js App Router: The project currently uses a mix of the pages and app directories. Migrating fully to the App Router would simplify the project structure, improve
   performance, and align with the latest Next.js features.
3. Enhance User Experience: Implementing consistent loading and error states, improving responsiveness, and providing better user feedback would make the application more robust and
   user-friendly.

## Detailed Improvement Plan

Here is a phased plan to implement these recommendations:

### Phase 1: Foundational Improvements (Standardization & Abstraction)

This phase focuses on cleaning up the codebase, standardizing the project structure, and improving the abstraction of core functionalities.

1. Standardize Project Structure:
   * Unify Server File: Consolidate server.js, server.mjs, and server.ts into a single server.ts file to remove redundancy.
   * Migrate to App Router: Move all routes from the pages/api directory to the app/api directory. This will centralize routing logic within the app directory.
   * Standardize Naming Conventions: Ensure all files and components follow a consistent naming convention (e.g., PascalCase for components, kebab-case for files).

2. Introduce a UI Component Library:
   * Integrate ShadCN/UI: Add ShadCN/UI to the project to leverage its extensive library of accessible and customizable components.
   * Replace Custom Components: Gradually replace custom-built components in the components/ directory with their ShadCN/UI equivalents. This will improve visual consistency and reduce
     maintenance overhead.

3. Refactor Core Logic:
   * Centralize Data Fetching: Create a dedicated module (e.g., lib/data-service.ts) to handle all data fetching logic, abstracting away the details of using Prisma and external APIs.
   * Isolate Business Logic: Ensure that business logic (e.g., session processing, metric calculation) is separated from the API routes and UI components.

### Phase 2: UX and Visual Enhancements

This phase focuses on improving the user-facing aspects of the application.

1. Implement Comprehensive Loading and Error States:
   * Skeleton Loaders: Use skeleton loaders for dashboard components to provide a better loading experience.
   * Global Error Handling: Implement a global error handling strategy to catch and display user-friendly error messages for API failures or other unexpected issues.

2. Redesign the Dashboard:
   * Improve Information Hierarchy: Reorganize the dashboard to present the most important information first.
   * Enhance Visual Appeal: Use the new component library to create a more modern and visually appealing design with a consistent color palette and typography.
   * Improve Chart Interactivity: Add features like tooltips, zooming, and filtering to the charts to make them more interactive and informative.

3. Ensure Full Responsiveness:
   * Mobile-First Approach: Review and update all pages and components to ensure they are fully responsive and usable on a wide range of devices.

### Phase 3: Advanced Topics (Security, Performance, and Documentation)

This phase focuses on long-term improvements to the project's stability, performance, and maintainability.

1. Conduct a Security Review:
   * Input Validation: Ensure that all user inputs are properly validated on both the client and server sides.
   * Dependency Audit: Regularly audit dependencies for known vulnerabilities.

2. Optimize Performance:
   * Code Splitting: Leverage Next.js's automatic code splitting to reduce initial load times.
   * Caching: Implement caching strategies for frequently accessed data to reduce database load and improve API response times.

3. Expand Documentation:
   * API Documentation: Create detailed documentation for all API endpoints.
   * Component Library: Document the usage and props of all reusable components.
   * Update `AGENTS.md`: Keep the AGENTS.md file up-to-date with any architectural changes.

Would you like me to start implementing any part of this plan? I would suggest starting with Phase 1 to build a solid foundation for the other improvements.

## Dashboard Integration

- [ ] **Resolve `GeographicMap.tsx` and `ResponseTimeDistribution.tsx` data simulation**
  - Investigate integrating real data sources with server-side analytics
  - Replace simulated data mentioned in `docs/dashboard-components.md`

## Component Specific

- [ ] **Implement robust emailing of temporary passwords**

  - File: `pages/api/dashboard/users.ts`
  - Set up proper email service integration

- [x] **Session page improvements** ✅
  - File: `app/dashboard/sessions/page.tsx`
  - Implemented pagination, advanced filtering, and sorting

## File Cleanup

- [x] **Remove backup files** ✅
  - Reviewed and removed `.bak` and `.new` files after integration
  - Cleaned up `GeographicMap.tsx.bak`, `SessionDetails.tsx.bak`, `SessionDetails.tsx.new`

## Database Schema Improvements

- [ ] **Update EndTime field**

  - Make `endTime` field nullable in Prisma schema to match TypeScript interfaces

- [ ] **Add database indices**

  - Add appropriate indices to improve query performance
  - Focus on dashboard metrics and session listing queries

- [ ] **Implement production email service**
  - Replace console logging in `lib/sendEmail.ts`
  - Consider providers: Nodemailer, SendGrid, AWS SES

## General Enhancements & Features

- [ ] **Real-time updates**

  - Implement for dashboard and session list
  - Consider WebSockets or Server-Sent Events

- [ ] **Data export functionality**

  - Allow users (especially admins) to export session data
  - Support CSV format initially

- [ ] **Customizable dashboard**
  - Allow users to customize dashboard view
  - Let users choose which metrics/charts are most important

## Testing & Quality Assurance

- [ ] **Comprehensive testing suite**

  - [ ] Unit tests for utility functions and API logic
  - [ ] Integration tests for API endpoints with database
  - [ ] End-to-end tests for user flows (Playwright or Cypress)

- [ ] **Error monitoring and logging**

  - Integrate robust error monitoring service (Sentry)
  - Enhance server-side logging

- [ ] **Accessibility improvements**
  - Review application against WCAG guidelines
  - Improve keyboard navigation and screen reader compatibility
  - Check color contrast ratios

## Security Enhancements

- [x] **Password reset functionality** ✅

  - Implemented secure password reset mechanism
  - Files: `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`, `pages/api/forgot-password.ts`, `pages/api/reset-password.ts`

- [ ] **Two-Factor Authentication (2FA)**

  - Consider adding 2FA, especially for admin accounts

- [ ] **Input validation and sanitization**
  - Review all user inputs (API request bodies, query parameters)
  - Ensure proper validation and sanitization

## Code Quality & Development

- [ ] **Code review process**

  - Enforce code reviews for all changes

- [ ] **Environment configuration**

  - Ensure secure management of environment-specific configurations

- [ ] **Dependency management**

  - Periodically review dependencies for vulnerabilities
  - Keep dependencies updated

- [ ] **Documentation updates**
  - [ ] Ensure `docs/dashboard-components.md` reflects actual implementations
  - [ ] Verify "Dashboard Enhancements" are consistently applied
  - [ ] Update documentation for improved layout and visual hierarchies

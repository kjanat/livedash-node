# TODO.md

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

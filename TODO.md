# Application Improvement TODOs

This file lists general areas for improvement and tasks that are broader in scope or don't map to a single specific file.

## General Enhancements & Features

- [ ] **Real-time Updates:** Implement real-time updates for the dashboard and session list (e.g., using WebSockets or Server-Sent Events).
- [ ] **Data Export:** Provide functionality for users (especially admins) to export session data (e.g., to CSV).
- [ ] **Customizable Dashboard:** Allow users to customize their dashboard view, choosing which metrics or charts are most important to them.
- [ ] **Resolve `GeographicMap.tsx` and `ResponseTimeDistribution.tsx` data simulation:** The `docs/dashboard-components.md` mentions these use simulated data. Investigate integrating real data sources.

## Robustness and Maintainability

- [ ] **Comprehensive Testing:**
  - [ ] Implement unit tests (e.g., for utility functions, API logic).
  - [ ] Implement integration tests (e.g., for API endpoints with the database).
  - [ ] Implement end-to-end tests (e.g., for user flows using Playwright or Cypress).
- [ ] **Error Monitoring and Logging:** Integrate a robust error monitoring service (like Sentry) and enhance server-side logging.
- [ ] **Accessibility (a11y):** Review and improve the application's accessibility according to WCAG guidelines (keyboard navigation, screen reader compatibility, color contrast).

## Security Enhancements

- [ ] **Password Reset Functionality:** Implement a secure password reset mechanism. (Related: `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`, `pages/api/forgot-password.ts`, `pages/api/reset-password.ts` - ensure these are robust and secure if already implemented).
- [ ] **Two-Factor Authentication (2FA):** Consider adding 2FA, especially for admin accounts.
- [ ] **Input Validation and Sanitization:** Rigorously review and ensure all user inputs (API request bodies, query parameters) are validated and sanitized.

## Code Quality and Development Practices

- [ ] **Code Reviews:** Enforce code reviews for all changes.
- [ ] **Environment Configuration:** Ensure secure and effective management of environment-specific configurations.
- [ ] **Dependency Review:** Periodically review dependencies for vulnerabilities or updates.
- [ ] **Documentation:**
  - Ensure `docs/dashboard-components.md` is up-to-date with actual component implementations.
  - Verify that "Dashboard Enhancements" (Improved Layout, Visual Hierarchies, Color Coding) are consistently applied.

## Component Specific

- [ ] **`components/SessionDetails.tsx.new`:** Review, complete TODOs within the file, and integrate as the primary `SessionDetails.tsx` component, removing/archiving older versions (`SessionDetails.tsx`, `SessionDetails.tsx.bak`).
- [ ] **`components/GeographicMap.tsx`:** Check if `GeographicMap.tsx.bak` is still needed or can be removed.
- [ ] **`app/dashboard/sessions/page.tsx`:** Implement pagination, advanced filtering, and sorting.
- [ ] **`pages/api/dashboard/users.ts`:** Implement robust emailing of temporary passwords.

## File Cleanup

- [ ] Review and remove `.bak` and `.new` files once changes are integrated (e.g., `GeographicMap.tsx.bak`, `SessionDetails.tsx.bak`, `SessionDetails.tsx.new`).

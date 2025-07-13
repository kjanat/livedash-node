# CSRF Protection Implementation

This document describes the comprehensive CSRF (Cross-Site Request Forgery) protection implemented in the LiveDash application.

## Overview

CSRF protection has been implemented to prevent cross-site request forgery attacks on state-changing operations. The implementation follows industry best practices and provides protection at multiple layers:

- **Middleware Level**: Automatic CSRF validation for protected endpoints
- **tRPC Level**: CSRF protection for all state-changing tRPC procedures
- **Client Level**: Automatic token management and inclusion in requests
- **Component Level**: React components and hooks for easy integration

## Implementation Components

### 1. Core CSRF Library (`lib/csrf.ts`)

The core CSRF functionality includes:

- **Token Generation**: Cryptographically secure token generation using the `csrf` library
- **Token Verification**: Server-side token validation
- **Request Parsing**: Support for tokens in headers, JSON bodies, and form data
- **Client Utilities**: Browser-side token management and request enhancement

**Key Functions:**

- `generateCSRFToken()` - Creates new CSRF tokens
- `verifyCSRFToken()` - Validates tokens server-side
- `CSRFProtection.validateRequest()` - Request validation middleware
- `CSRFClient.*` - Client-side utilities

### 2. Middleware Protection (`middleware/csrfProtection.ts`)

Provides automatic CSRF protection for API endpoints:

**Protected Endpoints:**

- `/api/auth/*` - Authentication endpoints
- `/api/register` - User registration
- `/api/forgot-password` - Password reset requests
- `/api/reset-password` - Password reset completion
- `/api/dashboard/*` - Dashboard API endpoints
- `/api/platform/*` - Platform admin endpoints
- `/api/trpc/*` - All tRPC endpoints

**Protected Methods:**

- `POST` - Create operations
- `PUT` - Update operations
- `DELETE` - Delete operations
- `PATCH` - Partial update operations

**Safe Methods (Not Protected):**

- `GET` - Read operations
- `HEAD` - Metadata requests
- `OPTIONS` - CORS preflight requests

### 3. tRPC Integration (`lib/trpc.ts`)

CSRF protection integrated into tRPC procedures:

**New Procedure Types:**

- `csrfProtectedProcedure` - Basic CSRF protection
- `csrfProtectedAuthProcedure` - CSRF + authentication protection
- `csrfProtectedCompanyProcedure` - CSRF + company access protection
- `csrfProtectedAdminProcedure` - CSRF + admin access protection

**Updated Router Example:**

```typescript
// Before
register: rateLimitedProcedure.input(registerSchema).mutation(async ({ input, ctx }) => {
  /* ... */
});

// After
register: csrfProtectedProcedure.input(registerSchema).mutation(async ({ input, ctx }) => {
  /* ... */
});
```

### 4. Client-Side Integration

#### tRPC Client (`lib/trpc-client.ts`)

- Automatic CSRF token inclusion in tRPC requests
- Token extracted from cookies and added to request headers

#### React Hooks (`lib/hooks/useCSRF.ts`)

- `useCSRF()` - Basic token management
- `useCSRFFetch()` - Enhanced fetch with automatic CSRF tokens
- `useCSRFForm()` - Form submission with CSRF protection

#### Provider Component (`components/providers/CSRFProvider.tsx`)

- Application-wide CSRF token management
- Automatic token fetching and refresh
- Context-based token sharing

#### Protected Form Component (`components/forms/CSRFProtectedForm.tsx`)

- Ready-to-use form component with CSRF protection
- Automatic token inclusion in form submissions
- Graceful fallback for non-JavaScript environments

### 5. API Endpoint (`app/api/csrf-token/route.ts`)

Provides CSRF tokens to client applications:

- `GET /api/csrf-token` - Returns new CSRF token
- Sets HTTP-only cookie for automatic inclusion
- Used by client-side hooks and components

## Configuration

### Environment Variables

```bash
# CSRF Secret (optional - defaults to NEXTAUTH_SECRET)
CSRF_SECRET=your-csrf-secret-key
```

### CSRF Configuration (`lib/csrf.ts`)

```typescript
export const CSRF_CONFIG = {
  cookieName: "csrf-token",
  headerName: "x-csrf-token",
  secret: env.CSRF_SECRET || env.NEXTAUTH_SECRET,
  cookie: {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
  },
};
```

## Usage Examples

### 1. Using CSRF in React Components

```tsx
import { useCSRFFetch } from "@/lib/hooks/useCSRF";

function MyComponent() {
  const { csrfFetch } = useCSRFFetch();

  const handleSubmit = async () => {
    // CSRF token automatically included
    const response = await csrfFetch("/api/dashboard/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "example" }),
    });
  };
}
```

### 2. Using CSRF Protected Forms

```tsx
import { CSRFProtectedForm } from "@/components/forms/CSRFProtectedForm";

function RegistrationForm() {
  return (
    <CSRFProtectedForm action="/api/register" method="POST">
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <button type="submit">Register</button>
    </CSRFProtectedForm>
  );
}
```

### 3. Using CSRF in tRPC Procedures

```typescript
// In your router file
export const userRouter = router({
  updateProfile: csrfProtectedAuthProcedure
    .input(userUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      // CSRF validation automatically performed
      // User authentication automatically verified
      return updateUserProfile(input, ctx.user);
    }),
});
```

### 4. Manual CSRF Token Handling

```typescript
import { CSRFClient } from "@/lib/csrf";

// Get token from cookies
const token = CSRFClient.getToken();

// Add to fetch options
const options = CSRFClient.addTokenToFetch({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

// Add to form data
const formData = new FormData();
CSRFClient.addTokenToFormData(formData);

// Add to object
const dataWithToken = CSRFClient.addTokenToObject({ data: "example" });
```

## Security Features

### 1. Token Properties

- **Cryptographically Secure**: Uses the `csrf` library with secure random generation
- **Short-Lived**: 24-hour expiration by default
- **HTTP-Only Cookies**: Prevents XSS-based token theft
- **SameSite Protection**: Reduces CSRF attack surface

### 2. Validation Process

1.  Extract token from request (header, form data, or JSON body)
2.  Retrieve stored token from HTTP-only cookie
3.  Verify tokens match
4.  Validate token cryptographic integrity
5.  Allow or reject request based on validation

### 3. Error Handling

- **Graceful Degradation**: Form fallbacks for JavaScript-disabled browsers
- **Clear Error Messages**: Specific error codes for debugging
- **Rate Limiting Integration**: Works with existing auth rate limiting
- **Logging**: Comprehensive logging for security monitoring

## Testing

### Test Coverage

- **Unit Tests**: Token generation, validation, and client utilities
- **Integration Tests**: Middleware behavior and endpoint protection
- **Component Tests**: React hooks and form components
- **End-to-End**: Full request/response cycle testing

### Running Tests

```bash
# Run all CSRF tests
pnpm test:vitest tests/unit/csrf*.test.ts tests/integration/csrf*.test.ts

# Run specific test files
pnpm test:vitest tests/unit/csrf.test.ts
pnpm test:vitest tests/integration/csrf-protection.test.ts
pnpm test:vitest tests/unit/csrf-hooks.test.tsx
```

## Monitoring and Debugging

### CSRF Validation Logs

Failed CSRF validations are logged with details:

```
CSRF validation failed for POST /api/dashboard/sessions: CSRF token missing from request
```

### Common Issues and Solutions

1.  **Token Missing from Request**

- Ensure CSRFProvider is wrapping your app
- Check that hooks are being used correctly
- Verify network requests include credentials

2.  **Token Mismatch**

- Clear browser cookies and refresh
- Check for multiple token sources conflicting
- Verify server and client time synchronization

3.  **Integration Issues**

- Ensure middleware is properly configured
- Check tRPC client configuration
- Verify protected procedures are using correct types

## Migration Guide

### For Existing Endpoints

1.  Update tRPC procedures to use CSRF-protected variants:

```typescript
// Old
someAction: protectedProcedure.mutation(async ({ ctx, input }) => {
  // mutation logic
});

// New
someAction: csrfProtectedAuthProcedure.mutation(async ({ ctx, input }) => {
  // mutation logic
});
```

2.  Update client components to use CSRF hooks:

```tsx
// Old
const { data, mutate } = trpc.user.update.useMutation();

// New - no changes needed, CSRF automatically handled
const { data, mutate } = trpc.user.update.useMutation();
```

3.  Update manual API calls to include CSRF tokens:

   <!-- prettier-ignore -->

```typescript
// Old
fetch("/api/endpoint", { method: "POST", body: data });

// New
const { csrfFetch } = useCSRFFetch();
csrfFetch("/api/endpoint", { method: "POST", body: data });
```

## Performance Considerations

- **Minimal Overhead**: Token validation adds ~1ms per request
- **Efficient Caching**: Tokens cached in memory and cookies
- **Selective Protection**: Only state-changing operations protected
- **Optimized Parsing**: Smart content-type detection for token extraction

## Security Best Practices

1.  **Always use HTTPS in production** - CSRF tokens should never be transmitted over HTTP
2.  **Monitor CSRF failures** - Implement alerting for unusual CSRF failure patterns
3.  **Regular secret rotation** - Consider rotating CSRF secrets periodically
4.  **Validate referrer headers** - Additional protection layer (not implemented but recommended)
5.  **Content Security Policy** - Use CSP headers to prevent XSS attacks that could steal tokens

## Conclusion

The CSRF protection implementation provides comprehensive defense against cross-site request forgery attacks while maintaining ease of use for developers. The multi-layer approach ensures protection at the middleware, application, and component levels, with automatic token management reducing the risk of developer error.

For questions or issues related to CSRF protection, refer to the test files for examples and the security documentation for additional context.

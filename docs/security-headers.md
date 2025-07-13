# HTTP Security Headers Implementation

This document describes the comprehensive HTTP security headers implementation in LiveDash-Node to protect against XSS, clickjacking, and other web vulnerabilities.

## Overview

The application implements multiple layers of HTTP security headers to provide defense-in-depth protection against common web vulnerabilities identified in OWASP Top 10 and security best practices.

## Implemented Security Headers

### Core Security Headers

#### X-Content-Type-Options: nosniff

- **Purpose**: Prevents MIME type sniffing attacks
- **Protection**: Stops browsers from interpreting files as different MIME types than declared
- **Value**: `nosniff`

#### X-Frame-Options: DENY

- **Purpose**: Prevents clickjacking attacks
- **Protection**: Blocks embedding the site in frames/iframes
- **Value**: `DENY`

#### X-XSS-Protection: 1; mode=block

- **Purpose**: Enables XSS protection in legacy browsers
- **Protection**: Activates built-in XSS filtering (primarily for older browsers)
- **Value**: `1; mode=block`

#### Referrer-Policy: strict-origin-when-cross-origin

- **Purpose**: Controls referrer information leakage
- **Protection**: Limits referrer data sent to external sites
- **Value**: `strict-origin-when-cross-origin`

#### X-DNS-Prefetch-Control: off

- **Purpose**: Prevents DNS rebinding attacks
- **Protection**: Disables DNS prefetching to reduce attack surface
- **Value**: `off`

### Content Security Policy (CSP)

Comprehensive CSP implementation with the following directives:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests
```

#### Key CSP Directives

- **default-src 'self'**: Restrictive default for all resource types
- **script-src 'self' 'unsafe-eval' 'unsafe-inline'**: Allows Next.js dev tools and React functionality
- **style-src 'self' 'unsafe-inline'**: Enables TailwindCSS and component styles
- **img-src 'self' data: https:**: Allows secure image sources
- **frame-ancestors 'none'**: Prevents embedding (reinforces X-Frame-Options)
- **object-src 'none'**: Blocks dangerous plugins and embeds
- **upgrade-insecure-requests**: Automatically upgrades HTTP to HTTPS

### Permissions Policy

Controls browser feature access:

```
Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()
```

- **camera=()**: Disables camera access
- **microphone=()**: Disables microphone access
- **geolocation=()**: Disables location tracking
- **interest-cohort=()**: Blocks FLoC (privacy protection)
- **browsing-topics=()**: Blocks Topics API (privacy protection)

### Strict Transport Security (HSTS)

**Production Only**: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`

- **max-age=31536000**: 1 year HSTS policy
- **includeSubDomains**: Applies to all subdomains
- **preload**: Ready for HSTS preload list inclusion

## Configuration

### Next.js Configuration

Headers are configured in `next.config.js`:

```javascript
headers: async () => {
  return [
    {
      source: "/(.*)",
      headers: [
        // Security headers configuration
      ],
    },
    {
      source: "/(.*)",
      headers:
        process.env.NODE_ENV === "production"
          ? [
              // HSTS header for production only
            ]
          : [],
    },
  ];
};
```

### Environment-Specific Behavior

- **Development**: All headers except HSTS
- **Production**: All headers including HSTS

## Testing

### Unit Tests

Location: `tests/unit/http-security-headers.test.ts`

Tests cover:

- Individual header validation
- CSP directive verification
- Permissions Policy validation
- Environment-specific configuration
- Next.js compatibility checks

### Integration Tests

Location: `tests/integration/security-headers-basic.test.ts`

Tests cover:

- Next.js configuration validation
- Header generation verification
- Environment-based header differences

### Manual Testing

Use the security headers testing script:

```bash
# Test local development server
pnpm test:security-headers http://localhost:3000

# Test production deployment
pnpm test:security-headers https://your-domain.com
```

## Security Benefits

### Protection Against OWASP Top 10

1.  **A03:2021 - Injection**: CSP prevents script injection
2.  **A05:2021 - Security Misconfiguration**: Comprehensive headers reduce attack surface
3.  **A06:2021 - Vulnerable Components**: CSP limits execution context
4.  **A07:2021 - Identification and Authentication Failures**: HSTS prevents downgrade attacks

### Additional Security Benefits

- **Clickjacking Protection**: X-Frame-Options + CSP frame-ancestors
- **MIME Sniffing Prevention**: X-Content-Type-Options
- **Information Leakage Reduction**: Referrer-Policy
- **Privacy Protection**: Permissions Policy restrictions
- **Transport Security**: HSTS enforcement

## Maintenance

### Regular Reviews

1.  **Quarterly CSP Review**: Analyze CSP violations and tighten policies
2.  **Annual Header Audit**: Review new security headers and standards
3.  **Dependency Updates**: Ensure compatibility with framework updates

### Monitoring

- Monitor CSP violation reports (when implemented)
- Use online tools like securityheaders.com for validation
- Include security header tests in CI/CD pipeline

### Future Enhancements

Planned improvements:

1.  CSP violation reporting endpoint
2.  Nonce-based CSP for inline scripts
3.  Additional Permissions Policy restrictions
4.  Content-Type validation middleware

## Compatibility

### Next.js Compatibility

Headers are configured to be compatible with:

- Next.js 15+ App Router
- React 19 development tools
- TailwindCSS 4 styling system
- Development hot reload functionality

### Browser Support

Security headers are supported by:

- All modern browsers (Chrome 60+, Firefox 60+, Safari 12+)
- Graceful degradation for older browsers
- Progressive enhancement approach

## Troubleshooting

### Common Issues

1.  **CSP Violations**: Check browser console for CSP errors
2.  **Styling Issues**: Verify style-src allows 'unsafe-inline'
3.  **Script Errors**: Ensure script-src permits necessary scripts
4.  **Development Issues**: Use `pnpm dev:next-only` to isolate Next.js

### Debug Tools

- Browser DevTools Security tab
- CSP Evaluator: <https://csp-evaluator.withgoogle.com/>
- Security Headers Scanner: <https://securityheaders.com/>

## References

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN Security Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers#security)
- [Next.js Security Headers](https://nextjs.org/docs/app/api-reference/config/headers)
- [Content Security Policy Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

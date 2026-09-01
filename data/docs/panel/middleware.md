---
title: "Middleware & Handlers"
section: "Panel"
order: 48
description: "Request middleware, authentication, validation, and security layers."
---

# Middleware & Handlers

## Middleware Stack

Every HTTP request passes through a defined pipeline before reaching a route handler. The order matters because later middleware depends on data set by earlier ones.

### Pipeline Order

1. Express body parsers (JSON, URL-encoded)
2. Session parser (Redis-backed)
3. CORS headers
4. Security headers
5. Rate limiter
6. IP ban check
7. CSRF validation (state-changing routes)
8. Route handler

### Body Parsing

The panel uses Express built-in parsers:

- `express.json()` for JSON request bodies
- `express.urlencoded({ extended: true })` for form submissions

File uploads use `multer` with configurable size limits (see Validation Middleware below).

### Session Management

Sessions are powered by `express-session` with a Redis store (`connect-redis`).

| Config             | Value / Source             |
| ------------------ | -------------------------- |
| Store              | Redis (via `REDIS_URL`)    |
| Secret             | `SESSION_SECRET` env var   |
| Cookie name        | `connect.sid`              |
| Rolling            | `true` (reset on activity) |
| Resave             | `false`                    |
| Save uninitialized | `false`                    |

Session cookie flags:

- `httpOnly: true` (no JavaScript access)
- `secure: true` in production (HTTPS only)
- `sameSite: 'lax'` in production, `'none'` if behind reverse proxy
- `maxAge`: 24 hours by default

Session data stored per user:

- `user.id`, `user.email`, `user.isAdmin`, `user.role`, `user.username`
- `user.onboardingCompleted`, `user.onboardingSkipped`

Sessions are regenerated on login to prevent fixation attacks.

### CORS Configuration

Standard CORS headers are applied to API routes. Session cookies are scoped to the panel's domain. The `behindReverseProxy` setting affects whether `X-Forwarded-For` headers are trusted.

### Rate Limiting

Global rate limiting is configurable via admin settings:

| Setting            | Default | Description                 |
| ------------------ | ------- | --------------------------- |
| `rateLimitEnabled` | `true`  | Toggle rate limiting on/off |
| `rateLimitRpm`     | `100`   | Requests per minute per IP  |

Rate limits are enforced in the middleware pipeline before route handlers. The limiter uses Redis to track request counts per IP address.

### Security Headers

Standard security headers are set on all responses:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (when `NODE_ENV=production`)

## Authentication Middleware

The panel resolves the authenticated user from either a session cookie or an API key bearer token. Auth utilities live in `src/handlers/utils/auth/`.

### Session-Based Auth

The `isAuthenticated` middleware (`src/handlers/utils/auth/authUtil.ts`) checks for a valid session:

1. Parse session cookie
2. Look up session in Redis
3. Verify `user.id` exists in session data
4. Attach user to `req.user`

If any step fails, the request is rejected with a 401.

### API Key Auth (Bearer Token)

API key validation lives in `src/handlers/utils/api/apiValidator.ts`. It:

1. Reads the `Authorization` header
2. Extracts the `Bearer <token>` value
3. Looks up the key in the database (optionally hashed via `hashApiKeys` setting)
4. Validates the key is active
5. Attaches the key's capabilities to the request

API keys have scoped capabilities (e.g., `servers.*`, `files.read`). Session users bypass capability checks.

### Route Protection

Routes are protected by applying middleware in the route definition:

```typescript
router.get("/servers", isAuthenticated, handler);
```

For API routes that accept either session or API key auth:

```typescript
router.get("/api/v2/servers", isAuthenticatedOrApiKey, handler);
```

### Admin-Only Routes

Admin routes check `req.user.isAdmin` or use the `isAuthenticated` middleware combined with admin permission checks. The admin middleware is applied at the module level for `src/modules/admin/`.

## Validation Middleware

All inputs are validated before reaching business logic. Validation lives in Zod schemas and middleware functions.

### Zod Schema Validation

Request bodies, query parameters, and route parameters are validated with Zod schemas. The pattern is:

1. Define a Zod schema for the endpoint's expected input
2. Validate `req.body`, `req.query`, or `req.params` against the schema
3. Return 400 with structured error details on failure
4. Replace the raw input with the parsed (and type-safe) Zod output

Example:

```typescript
const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(0).max(200),
});
```

### Request Body Sanitization

Input sanitization happens alongside validation:

- Null bytes are stripped
- Path traversal sequences (`..`) are blocked in string inputs
- HTML tags are escaped where needed
- Length limits enforced on all string fields

### Parameter Validation

Route parameters (IDs, UUIDs) are validated to ensure they match expected formats:

- Database IDs must be positive integers
- UUIDs must match the standard format
- Enum parameters are checked against allowed values

### File Upload Limits

File uploads use `multer` with configurable limits:

| Limit      | Default | Description           |
| ---------- | ------- | --------------------- |
| `fileSize` | 10 MB   | Max single file size  |
| `files`    | 5       | Max files per request |

MIME type filtering restricts allowed file types per endpoint.

## Security Middleware

Security checks run early in the pipeline, before authentication or business logic.

### Rate Limiting (Per-Route, Per-IP)

The global rate limiter applies to all routes. Individual routes can apply additional per-route rate limits:

- Login endpoint: stricter limits (configurable via `loginMaxAttempts`)
- API endpoints: global `rateLimitRpm` applies
- Admin endpoints: no separate limit (protected by auth)

Rate limit data is stored in Redis with TTL matching the window.

### IP Banning

Admins can ban IP addresses. Banned IPs are stored in the `bannedIps` JSON array in panel settings. The ban check runs as middleware before route handlers:

```
POST /api/v2/admin/settings/ban-ip
{ "ip": "192.168.1.100", "reason": "Abuse" }
```

Banned IPs receive a 403 response immediately. No session or authentication check runs for banned IPs.

### Account Lockout

After exceeding `loginMaxAttempts` (default 5), the account is locked for `loginLockoutMinutes` (default 15). The `lockedUntil` timestamp is checked on each login attempt. Lockout is per-account, not per-IP.

### CSRF Protection

CSRF tokens are generated per-session and validated on state-changing requests (POST, PUT, DELETE). The token is included in the session data and verified against the `X-CSRF-Token` header or `_csrf` body field.

### Path Traversal Prevention

All file-path inputs are checked for traversal sequences:

- `..` is rejected in path parameters
- Null bytes (`%00`) are blocked
- Absolute paths are rejected for user-provided inputs

This applies to file manager routes, backup paths, and any endpoint that accepts a filesystem path.

## Handler Utilities

Shared utilities live in `src/handlers/utils/`. These are imported by route handlers and middleware.

### Permission Checking (`permissions.ts`)

The permission system is hierarchical and dot-separated. A wildcard `.*` grants all sub-permissions.

Permission resolution:

1. Admin users get full access (skip permission checks)
2. Role permissions are checked (from the user's assigned role)
3. For server-specific operations, sub-user permissions are checked

Usage in handlers:

```typescript
import { checkPermission } from "../handlers/permissions";

// Check if user has a specific permission
if (!checkPermission(user, "server.start")) {
  return res.status(403).json({ error: "Insufficient permissions" });
}
```

### Auth Utilities (`handlers/utils/auth/`)

| File             | Purpose                                  |
| ---------------- | ---------------------------------------- |
| `authUtil.ts`    | Session authentication middleware        |
| `authorization`  | Permission checking middleware           |
| `serverAuthUtil` | Sub-user permission checking for servers |

### Core Utilities (`handlers/utils/core/`)

| File             | Purpose                                 |
| ---------------- | --------------------------------------- |
| `cache.ts`       | Redis cache wrapper with TTL support    |
| `redis.ts`       | Redis client connection                 |
| `settingsCache`  | Panel settings cache (read-heavy)       |
| `securityCache`  | Rate limits, banned IPs, login attempts |
| `nodesCache`     | Node connection state cache             |
| `settingsLoader` | Settings initialization from database   |
| `databaseLoader` | Prisma client singleton                 |
| `envLoader`      | Environment variable loading            |

### Server Utilities (`handlers/utils/server/`)

| File                 | Purpose                   |
| -------------------- | ------------------------- |
| `installQueue.ts`    | Server installation queue |
| `runtimeQueue.ts`    | Runtime job queue         |
| `schedulerWorker.ts` | Cron schedule executor    |
| `jobRegistry.ts`     | Background job registry   |

### Node Utilities (`handlers/utils/node/`)

| File               | Purpose                              |
| ------------------ | ------------------------------------ |
| `nodesCache.ts`    | Node connection cache                |
| `nodeService.ts`   | Node health and stats                |
| `daemonService.ts` | HTTP client for daemon communication |

## Error Handling

### Typed Error Factory

The panel uses a typed error factory for consistent error creation. Errors include:

- HTTP status code
- Error code (machine-readable string)
- Human-readable message
- Optional metadata (validation details, etc.)

```typescript
import { createError } from "../handlers/errorFactory";

throw createError("VALIDATION_FAILED", 400, {
  field: "email",
  reason: "Invalid email format",
});
```

### Error Response Format

All API errors return a consistent JSON structure:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

For validation errors, `details` contains field-level errors:

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_FAILED",
  "details": {
    "email": "Invalid email format",
    "name": "Name is required"
  }
}
```

### Logging Errors

Errors are logged via the Winston logger (`src/handlers/logger.ts`):

- Application errors: `logger.error(message, { metadata })`
- Validation failures: `logger.warn(message, { metadata })`
- Auth failures: `logger.info(message, { metadata })`

All significant actions are also logged to the activity log with:

- User ID (who performed the action)
- IP address
- Timestamp
- Event type
- Metadata (JSON context)

Activity logs are append-only and cannot be modified by users.

### Error Pages

HTML error pages are rendered for non-API routes:

- `404 Not Found` - page not found
- `500 Internal Server Error` - server error

These are defined in `src/handlers/errorPages.ts` and rendered as EJS templates from `views/errors/`.

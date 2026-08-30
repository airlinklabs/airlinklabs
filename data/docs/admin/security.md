---
title: "Security"
description: "HMAC authentication, CSRF protection, rate limiting, and hardening."
section: "Administration"
order: 32
---

# Security Features

## Authentication Security

### Password Hashing

Passwords are hashed with bcrypt using a cost factor of 12. Raw passwords are never stored.

### Session Security

- Sessions stored in Redis (not in-memory)
- Session secret configured via `SESSION_SECRET` env var
- Session regenerated on login to prevent fixation
- `SameSite` and `Secure` flags based on environment.

### Rate Limiting

Configurable via admin settings:

- `rateLimitEnabled` (global toggle, default: true)
- `rateLimitRpm` (requests per minute, default: 100)

Applied at the middleware level before route handlers.

### Account Lockout

After `loginMaxAttempts` failed attempts (default 5), account is locked for `loginLockoutMinutes` (default 15 minutes).

### IP Banning

Admins can ban IP addresses. Banned IPs are rejected at the middleware level:

```
POST /api/v2/admin/settings/ban-ip
{ "ip": "192.168.1.100", "reason": "Abuse" }
```

Banned IPs are stored in the `bannedIps` JSON array in settings.

## Two-Factor Authentication

### TOTP (Authenticator Apps)

- Setup via `/api/v2/account/2fa/setup`
- Enable with verification code
- 8 recovery codes generated on enable
- Window of ±2 periods (±60 seconds)

### WebAuthn Passkeys

- FIDO2 standard (security keys, biometrics)
- Registration and authentication flows
- Multiple passkeys per user
- Device naming for management.

### Admin 2FA Requirement

`require2faForAdmins` setting forces all admin accounts to enable 2FA.

### Global 2FA Requirement

`twoFactorRequired` setting forces all users to enable 2FA.

## Transport Security

### HTTPS

- `enforceDaemonHttps` (force HTTPS when communicating with daemons)
- `behindReverseProxy` (trust `X-Forwarded-For` headers when behind nginx/Apache)

### CORS

The API uses standard CORS headers. Session cookies are scoped to the panel's domain.

## Input Validation

All API inputs are validated with Zod schemas before processing:

- Path traversal prevention (`..` blocked)
- Null byte prevention
- Type validation
- Length limits.

## API Key Security

- `hashApiKeys` setting hashes API keys in the database
- Keys have scoped capabilities (e.g., `servers.*`)
- Keys can be deactivated without deletion
- Session users bypass capability checks.

## Activity Logging

All significant actions are logged with:

- User ID (who performed the action)
- IP address
- Timestamp
- Event type
- Metadata (JSON context)

Logs are append-only and cannot be modified by users.

## Security Scanner (Radar)

File scanning for suspicious content:

- Basic file scanning
- VirusTotal integration for malware detection
- Configurable via `scannerEnabled` setting.

## Recommendations

1. Use HTTPS in production
2. Enable `require2faForAdmins`
3. Use strong `SESSION_SECRET` (generate with `openssl rand -hex 32`)
4. Enable rate limiting
5. Keep the panel updated
6. Use `behindReverseProxy: true` if behind a reverse proxy
7. Review activity logs regularly
8. Ban IPs of known abusers.

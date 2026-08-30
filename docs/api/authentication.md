# Authentication

Airlink supports multiple authentication methods. The panel resolves the authenticated user from either a session cookie or an API key bearer token.

## Session Authentication

Session auth is the default for browser-based access. Express-session stores session data in Redis.

### Login Flow

1. User submits email + password to the login endpoint
2. Panel verifies the password with bcrypt
3. If 2FA is enabled, the panel stores a pending user ID in the session and redirects to the 2FA page
4. After 2FA verification (TOTP or passkey), the session is regenerated and the user is logged in
5. Session cookie is set on the response

### Session Data

The session stores:

- `user.id` (user's database ID)
- `user.email` (email address)
- `user.isAdmin` (admin flag)
- `user.role` (role name)
- `user.username` (display name)
- `user.description` (bio)
- `user.onboardingCompleted` (onboarding state)
- `user.onboardingSkipped` (onboarding skip state)

### Session Security

- Sessions are stored in Redis (not in-memory)
- Session secret is configured via `SESSION_SECRET` env var
- Sessions are regenerated on login to prevent fixation
- `SameSite` and `Secure` flags are set based on environment.

## API Key Authentication

API keys allow programmatic access to the V2 API. Send the key in the `Authorization` header:

```
Authorization: Bearer your_api_key_here
```

### Creating API Keys

API keys are created through the admin panel or the V2 API:

```
POST /api/v2/admin/apikeys
{
  "name": "My Integration",
  "description": "For CI/CD pipeline",
  "permissions": ["servers.*", "files.read"]
}
```

### Capabilities

Each API key declares a set of capability scopes. The API validates that the key has the required capability for each endpoint.

Wildcard capabilities (`servers.*`) grant all sub-capabilities (`servers.read`, `servers.write`).

Session users bypass capability checks (they get full access if authenticated).

See [api/v2-reference.md](api/v2-reference.md) for the full capability list.

## TOTP Two-Factor Authentication

Time-based one-time passwords using authenticator apps (Google Authenticator, Authy, etc.).

### Setup Flow

1. `GET /api/v2/account/2fa/setup` (returns a TOTP secret and `otpauth://` URL)
2. User scans the QR code in their authenticator app
3. `POST /api/v2/account/2fa/enable` with `{ code }` (verifies the code and enables 2FA)
4. Returns 8 recovery codes (one-time use)

### Login with 2FA

After password verification, if 2FA is enabled:

1. Panel redirects to the 2FA page
2. User enters the 6-digit TOTP code
3. Panel verifies with a window of ±2 periods (±60 seconds)

### Disabling 2FA

`POST /api/v2/account/2fa/disable` with either:

- `{ code }` (current TOTP code)
- `{ recoveryCode }` (one of the recovery codes)

### Recovery Codes

8 random hex strings generated when 2FA is enabled. Each code can be used once. Stored as a JSON array in the database.

## WebAuthn Passkeys

FIDO2 passkey authentication. Supports security keys (YubiKey), platform authenticators (Touch ID, Windows Hello), and synced passkeys.

### Registration

1. `POST /api/v2/account/passkey/register/options` (generates a registration challenge)
2. Browser prompts for passkey creation
3. `POST /api/v2/account/passkey/register/verify` (verifies and saves the credential)

### Authentication

Used as a 2FA method during login:

1. After password verification, `POST /api/v2/passkey/auth/options` (generates auth challenge)
2. Browser prompts for passkey
3. `POST /api/v2/passkey/auth/verify` (verifies and completes login)

### Managing Passkeys

- `GET /api/v2/account/passkey` (list registered passkeys)
- `DELETE /api/v2/account/passkey/:id` (remove a passkey)

If all passkeys are removed, `passkeyEnabled` is set to false on the user account.

## Password Reset

1. User requests a reset link (via email if SMTP is configured)
2. Panel generates a unique token with an expiration time
3. User clicks the link and sets a new password
4. Token is marked as used.

Password requirements:

- Minimum 8 characters, maximum 128
- Must contain uppercase, lowercase, and a number.

## Login Security

### Rate Limiting

Configurable via admin settings:

- `loginMaxAttempts` (max failed attempts before lockout, default: 5)
- `loginLockoutMinutes` (lockout duration, default: 15)
- `rateLimitEnabled` (global rate limiting toggle)
- `rateLimitRpm` (requests per minute limit, default: 100)

### IP Banning

Admins can ban IP addresses. Banned IPs are rejected at the middleware level before any route handler runs.

### Account Lockout

After exceeding `loginMaxAttempts`, the account is locked for `loginLockoutMinutes`. The `lockedUntil` timestamp is checked on each login attempt.

## First User

When no users exist in the database, the registration page is accessible to everyone. The first user to register becomes the admin. After that, registration is controlled by the `allowRegistration` setting.

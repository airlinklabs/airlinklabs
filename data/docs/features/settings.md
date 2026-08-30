---
title: "Panel Settings"
description: "Configure panel branding, features, rate limits, and more."
section: "Features"
order: 22
---

# Admin Settings

All panel settings are stored in a single `settings` database row. Admins can modify them through the admin panel or API.

## Settings Categories

### General Settings

| Setting             | Default                 | Description                  |
| ------------------- | ----------------------- | ---------------------------- |
| `title`             | "Airlink"               | Panel title                  |
| `description`       | "Airlink is..."         | Panel description            |
| `logo`              | "../assets/logo.png"    | Logo path                    |
| `favicon`           | "../assets/favicon.ico" | Favicon path                 |
| `theme`             | "default"               | UI theme                     |
| `lightTheme`        | "default"               | Light theme                  |
| `darkTheme`         | "default"               | Dark theme                   |
| `language`          | "en"                    | Default language             |
| `allowRegistration` | false                   | Allow public registration    |
| `uploadLimit`       | 100                     | File upload limit (MB)       |
| `onboardingEnabled` | true                    | Show onboarding to new users |

```
PATCH /api/v2/admin/settings/general
{ "title": "My Panel", "allowRegistration": true }
```

### Security Settings

| Setting               | Default | Description                    |
| --------------------- | ------- | ------------------------------ |
| `loginMaxAttempts`    | 5       | Max failed login attempts      |
| `loginLockoutMinutes` | 15      | Lockout duration               |
| `rateLimitEnabled`    | true    | Enable rate limiting           |
| `rateLimitRpm`        | 100     | Requests per minute            |
| `enforceDaemonHttps`  | false   | Force HTTPS to daemons         |
| `require2faForAdmins` | false   | Require 2FA for admin accounts |
| `behindReverseProxy`  | false   | Trust X-Forwarded-For headers  |
| `hashApiKeys`         | false   | Hash API keys in database      |

```
PATCH /api/v2/admin/settings/security
{ "rateLimitEnabled": true, "rateLimitRpm": 200 }
```

### Server Policy Settings

| Setting                       | Default | Description                    |
| ----------------------------- | ------- | ------------------------------ |
| `allowUserCreateServer`       | false   | Users can create servers       |
| `allowUserDeleteServer`       | false   | Users can delete servers       |
| `defaultServerLimit`          | 0       | Default max servers per user   |
| `defaultMaxMemory`            | 512     | Default memory limit (MB)      |
| `defaultMaxCpu`               | 100     | Default CPU limit              |
| `defaultMaxStorage`           | 5120    | Default storage limit (MB)     |
| `defaultMaxDatabases`         | 0       | Default database limit         |
| `defaultOverallocateMemory`   | 0       | Default memory overallocation  |
| `defaultOverallocateDisk`     | 0       | Default disk overallocation    |
| `defaultOverallocateCpu`      | 0       | Default CPU overallocation     |
| `allowPrivilegedServerLimit`  | 5       | Admin max servers              |
| `allowPrivilegedMaxMemory`    | 2048    | Admin max memory               |
| `allowPrivilegedMaxCpu`       | 200     | Admin max CPU                  |
| `allowPrivilegedMaxStorage`   | 61440   | Admin max storage              |
| `allowPrivilegedMaxDatabases` | 10      | Admin max databases            |
| `defaultMemory`               | 512     | Server creation default memory |
| `defaultCpu`                  | 100     | Server creation default CPU    |
| `defaultDisk`                 | 5120    | Server creation default disk   |
| `maxServersPerUser`           | 10      | Hard cap on servers per user   |
| `onboardingSteps`             | "[]"    | Onboarding step configuration  |

```
PATCH /api/v2/admin/settings/server-policy
{ "allowUserCreateServer": true, "defaultMaxMemory": 1024 }
```

### Feature Toggles

| Setting                 | Default | Description                    |
| ----------------------- | ------- | ------------------------------ |
| `twoFactorRequired`     | false   | Require 2FA for all users      |
| `sftpEnabled`           | true    | Enable SFTP access             |
| `backupsEnabled`        | true    | Enable backup system           |
| `schedulesEnabled`      | true    | Enable scheduled tasks         |
| `databasesEnabled`      | true    | Enable database management     |
| `fileManagerEnabled`    | true    | Enable file manager            |
| `consoleEnabled`        | true    | Enable server console          |
| `playerTrackingEnabled` | false   | Enable player stats collection |
| `scannerEnabled`        | true    | Enable file scanner            |
| `airlinkCloudEnabled`   | false   | Enable Airlink Cloud features  |

```
PATCH /api/v2/admin/settings/features
{ "backupsEnabled": true, "consoleEnabled": true }
```

### SMTP Settings

| Setting         | Default | Description            |
| --------------- | ------- | ---------------------- |
| `smtpHost`      | null    | SMTP server hostname   |
| `smtpPort`      | 587     | SMTP port              |
| `smtpUser`      | null    | SMTP username          |
| `smtpPassword`  | null    | SMTP password          |
| `smtpFrom`      | null    | From address           |
| `smtpSecure`    | false   | Use TLS                |
| `emailCooldown` | 30      | Seconds between emails |

```
PATCH /api/v2/admin/settings/smtp
{ "smtpHost": "smtp.gmail.com", "smtpPort": 587 }
```

Test SMTP:

```
POST /api/v2/admin/settings/smtp/test
```

### S3 Settings

| Setting       | Default | Description         |
| ------------- | ------- | ------------------- |
| `s3Enabled`   | false   | Enable S3 storage   |
| `s3Endpoint`  | null    | S3 endpoint URL     |
| `s3Region`    | null    | AWS region          |
| `s3Bucket`    | null    | Bucket name         |
| `s3AccessKey` | null    | Access key          |
| `s3SecretKey` | null    | Secret key          |
| `s3PathStyle` | false   | Use path-style URLs |

```
PATCH /api/v2/admin/settings/s3
{ "s3Enabled": true, "s3Endpoint": "https://s3.amazonaws.com" }
```

Test S3:

```
POST /api/v2/admin/settings/s3/test
```

### IP Management

Ban IP addresses:

```
POST /api/v2/admin/settings/ban-ip
{ "ip": "192.168.1.100", "reason": "Abuse" }
```

Unban:

```
POST /api/v2/admin/settings/unban-ip
{ "ip": "192.168.1.100" }
```

Banned IPs are stored as a JSON array in the `bannedIps` setting field. The middleware checks this list before any route handler runs.

### Wallpaper Settings

Custom wallpapers for different pages:

| Setting             | Description              |
| ------------------- | ------------------------ |
| `loginWallpaper`    | Login page background    |
| `registerWallpaper` | Register page background |
| `panelWallpaper`    | Main panel background    |

### Cloud Settings

| Setting                     | Description           |
| --------------------------- | --------------------- |
| `airlinkCloudApiKey`        | Airlink Cloud API key |
| `airlinkCloudBackupEnabled` | Enable cloud backups  |

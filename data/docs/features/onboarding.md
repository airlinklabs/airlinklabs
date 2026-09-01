---
title: "Onboarding"
description: "First-run setup wizard and configuration guides."
section: "Features"
order: 21
---

# Onboarding System

The onboarding system walks new users through the panel's features on their first login.

## How It Works

1. New user logs in for the first time
2. Panel checks `onboardingCompleted` and `onboardingSkipped` flags
3. If neither is true, the onboarding flow is shown
4. User completes or skips the steps
5. Flags are updated in the database

## Configuration

Onboarding is controlled by:

| Setting             | Description                    |
| ------------------- | ------------------------------ |
| `onboardingEnabled` | Master toggle (default: true)  |
| `onboardingSteps`   | JSON array of step definitions |

Admins can customize which steps appear in the onboarding flow through the `onboardingSteps` setting.

## User State

| Field                 | Description             |
| --------------------- | ----------------------- |
| `onboardingCompleted` | User finished all steps |
| `onboardingSkipped`   | User chose to skip      |

## API Endpoints

### Complete Onboarding

```
POST /api/v2/account/onboarding/complete
```

### Skip Onboarding

```
POST /api/v2/account/onboarding/skip
```

### Reset Onboarding (Admin)

Admins can reset a user's onboarding state:

```
POST /api/v2/admin/users/:id/onboarding/reset
```

This sets both `onboardingCompleted` and `onboardingSkipped` to false, so the user sees onboarding again on their next login.

## Views

The onboarding system uses the following views:

- `views/user/2fa-setup.ejs` (2FA setup step)
- Other onboarding steps rendered dynamically based on configuration

## Module

The onboarding module (`src/modules/user/onboarding.ts`) handles the page routes for the onboarding flow.

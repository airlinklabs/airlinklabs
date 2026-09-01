---
title: "CI/CD Workflows"
section: "Development"
order: 64
description: "GitHub Actions workflows for build, test, and deployment."
---

# CI/CD Workflows

AirLink uses GitHub Actions for continuous integration and deployment. Every push, pull request, and release triggers automated workflows that check code quality, run tests, and deploy changes.

## Overview

Three components have separate workflow pipelines:

- **Panel** - web interface, deployed to production servers
- **Daemon** - node agent, built as cross-platform binaries
- **Site** - documentation and landing pages, deployed to GitHub Pages

Each workflow is defined in `.github/workflows/` as YAML files. Workflows run on GitHub-hosted runners (ubuntu-latest, macos-latest, windows-latest) and use caching to speed up repeated builds.

## Panel Workflows

### Build & Test

Runs on every push and pull request to `main`. This is the primary quality gate.

```yaml
name: Panel CI
on:
  push:
    branches: [main]
    paths:
      - "panel/**"
  pull_request:
    branches: [main]
    paths:
      - "panel/**"
```

Steps:

1. Checkout code
2. Setup Node.js 20 with npm cache
3. Install dependencies (`npm ci`)
4. TypeScript type check (`npx tsc --noEmit`)
5. Lint (`npm run lint`)
6. Run tests (`npm test`)

If any step fails, the PR is blocked from merging.

### Deploy

Triggers on push to `main` when panel files change. Builds the production bundle and deploys to the running server.

```yaml
name: Panel Deploy
on:
  push:
    branches: [main]
    paths:
      - "panel/**"
```

Steps:

1. Checkout code
2. Setup Node.js 20
3. Install dependencies
4. Build production bundle (`npm run build`)
5. Run database migrations if needed
6. Deploy to production server
7. Restart the panel service

Deployments use SSH to connect to the target server. The private key and server address are stored as repository secrets:

- `DEPLOY_SSH_KEY` - SSH private key for deployment
- `DEPLOY_HOST` - Server hostname or IP
- `DEPLOY_USER` - SSH username
- `DEPLOY_PATH` - Path to the panel installation on the server

### Preview Deployments

Pull requests get automatic preview deployments so reviewers can see changes before merging. Each PR gets a unique subdomain.

```yaml
name: Panel Preview
on:
  pull_request:
    branches: [main]
    paths:
      - "panel/**"
```

Steps:

1. Build the panel
2. Deploy to a preview environment
3. Comment on the PR with the preview URL

Preview deployments are cleaned up when the PR is closed or merged.

## Daemon Workflows

### Build

Runs on push and PR for daemon code changes. Checks TypeScript, linting, and runs tests.

```yaml
name: Daemon CI
on:
  push:
    branches: [main]
    paths:
      - "daemon/**"
  pull_request:
    branches: [main]
    paths:
      - "daemon/**"
```

Steps:

1. Checkout code
2. Setup Node.js 20
3. Install dependencies
4. TypeScript type check
5. Lint
6. Run tests

### Release

Builds cross-platform binaries when a new release is tagged. Produces six binaries covering all supported platforms.

```yaml
name: Daemon Release
on:
  release:
    types: [published]
```

Build matrix:

| Platform      | Target          |
| ------------- | --------------- |
| Linux x64     | `linux-x64`     |
| Linux ARM64   | `linux-arm64`   |
| macOS x64     | `macos-x64`     |
| macOS ARM64   | `macos-arm64`   |
| Windows x64   | `windows-x64`   |
| Windows ARM64 | `windows-arm64` |

Each binary is built on its native platform for best compatibility. Build steps:

1. Checkout the release tag
2. Setup Node.js on the target platform
3. Install production dependencies
4. Bundle with `esbuild` or `pkg`
5. Upload binary as a release asset

Binaries are uploaded to the GitHub Release page as downloadable assets.

### Embedded Assets

The daemon embeds certain storage files directly into the compiled binary. A workflow generates `embedded.ts` from these files before builds.

```yaml
name: Daemon Embedded Assets
on:
  push:
    branches: [main]
    paths:
      - "daemon/storage/**"
```

Steps:

1. Read files from `daemon/storage/`
2. Generate `daemon/src/embedded.ts` with file contents as string constants
3. Commit the generated file (or fail if uncommitted changes detected)

This ensures the binary always contains the latest default configurations and schema files.

## Site Workflows

### Build

Generates the static documentation site from markdown files.

```yaml
name: Site Build
on:
  push:
    branches: [main]
    paths:
      - "site/**"
      - "data/docs/**"
```

Steps:

1. Checkout code
2. Setup Node.js
3. Install dependencies
4. Build static site (`npm run build`)

### Deploy

Publishes the built site to GitHub Pages or a custom domain.

```yaml
name: Site Deploy
on:
  push:
    branches: [main]
    paths:
      - "site/**"
      - "data/docs/**"
```

Steps:

1. Build the site
2. Deploy to GitHub Pages using `actions/deploy-pages`
3. Update the custom domain DNS if configured

The site is available at the configured URL after deployment completes.

## Workflow Files

### Directory Structure

```
.github/
└── workflows/
    ├── panel-ci.yml          # Panel build and test
    ├── panel-deploy.yml      # Panel production deploy
    ├── panel-preview.yml     # PR preview deployments
    ├── daemon-ci.yml         # Daemon build and test
    ├── daemon-release.yml    # Daemon binary builds
    ├── daemon-embedded.yml   # Embedded asset generation
    ├── site-build.yml        # Site build
    └── site-deploy.yml       # Site deployment
```

### Trigger Events

| Event          | When it fires                                      |
| -------------- | -------------------------------------------------- |
| `push`         | Code pushed to a branch (usually `main`)           |
| `pull_request` | PR opened, updated, or reopened against `main`     |
| `release`      | A GitHub release is published                      |
| `schedule`     | Cron expression (used for periodic security scans) |

Path filters are used to avoid running unrelated workflows. For example, a change in `panel/` does not trigger daemon workflows.

### Secrets and Environment Variables

Secrets are configured in the repository settings under Settings > Secrets and variables > Actions.

| Secret           | Purpose                          |
| ---------------- | -------------------------------- |
| `DEPLOY_SSH_KEY` | SSH key for panel deployment     |
| `DEPLOY_HOST`    | Panel server address             |
| `DEPLOY_USER`    | SSH username                     |
| `DEPLOY_PATH`    | Panel installation path          |
| `NPM_TOKEN`      | npm publish token (if needed)    |
| `GH_TOKEN`       | GitHub token for release uploads |

Environment variables can be set per workflow or per job. Use `env:` at the workflow level for shared values, or `env:` at the job level for job-specific ones.

### Caching Strategies

Workflows use GitHub Actions cache to speed up builds:

- **npm cache**: Cache `~/.npm` based on `package-lock.json` hash
- **Node modules**: Cache `node_modules/` keyed on OS and lockfile
- **Build output**: Cache `dist/` for incremental builds

Example cache configuration:

```yaml
- name: Cache node modules
  uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

## Local Development

### Running Tests Locally

```bash
cd panel
npm test
```

Tests run with Jest by default. The test suite covers:

- API endpoint handlers
- Service business logic
- Utility functions
- Middleware

To run a specific test file:

```bash
npm test -- path/to/test.test.ts
```

For watch mode during development:

```bash
npm test -- --watch
```

### Linting and Formatting

```bash
cd panel
npm run lint
```

The linter uses ESLint with the project's configured rules. Fix auto-fixable issues:

```bash
npm run lint -- --fix
```

Format code with Prettier:

```bash
npx prettier --write .
```

### Type Checking

```bash
cd panel
npx tsc --noEmit
```

This runs the TypeScript compiler without emitting files. It catches type errors without producing output. Run this before committing to catch issues early.

## Release Process

### Version Bumping

Update the version in `package.json`:

```bash
cd panel
npm version patch   # 1.0.0 -> 1.0.1
npm version minor   # 1.0.0 -> 1.1.0
npm version major   # 1.0.0 -> 2.0.0
```

This creates a git commit and tag automatically.

### Tag Creation

Tags follow semantic versioning:

```bash
git tag v1.0.1
git push origin v1.0.1
```

Or use the GitHub UI to create a release from the tag.

### Binary Builds for Daemon

When a release is published, the daemon workflow automatically builds binaries for all platforms. The workflow:

1. Checks out the tagged commit
2. Installs dependencies with `npm ci`
3. Bundles the daemon into a single file per platform
4. Names binaries consistently: `airlink-daemon-{platform}-{arch}`

For manual binary builds:

```bash
cd daemon
npm run build
```

### Changelog Generation

Generate a changelog from git commits between tags:

```bash
git log v1.0.0..v1.0.1 --oneline
```

GitHub also auto-generates release notes from merged PRs when publishing a release. Edit the release notes to add context or group related changes.

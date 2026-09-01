---
title: "Service Layer"
section: "Panel"
order: 47
description: "Backend services for business logic, queueing, and data access."
---

## Overview

The service layer contains all core business logic, separated from HTTP route handlers. Services are responsible for data access, validation, communication with external systems (daemon, S3), and orchestration of operations that may involve multiple database tables or background jobs.

All services live in `src/services/`. There are 14 service files, each owning a distinct domain. Route handlers in `src/routes/` delegate to services rather than implementing logic directly. This keeps controllers thin and makes business logic reusable across different entry points (HTTP, console WebSocket, CLI commands, queue jobs).

## Service List

### ServerService

Handles server lifecycle: creation, deletion, power actions (start, stop, restart, kill), and resource validation. Checks node capacity before allocating a server. Interfaces with the daemon over HTTP to send power commands. Validates user permissions against server ownership and subuser access.

### UserService

User management, authentication, and quota enforcement. Handles creation, password changes, email verification, and two-factor authentication. Tracks resource quotas (servers, databases, allocations) against plan limits. Generates and validates API keys for external access.

### NodeService

Communication with panel nodes. Pulls node statistics (CPU, memory, disk, network), handles node verification and certificate exchange. Maintains the node connection pool and determines which nodes have capacity for new servers. Queries daemon endpoints for real-time resource data.

### DatabaseService

Database host management and database CRUD. Creates and deletes databases on remote MySQL/PostgreSQL hosts. Assigns databases to servers and manages access credentials. Validates host connectivity before provisioning.

### BackupService

Backup creation, restoration, and S3 storage. Queues backup jobs that run on the daemon. Uploads completed backups to configured S3-compatible storage. Manages backup retention and restoration to existing servers.

### ScheduleService

Cron-style scheduling of recurring tasks. Stores schedule definitions and their associated tasks (command execution, power actions, backups). The scheduler runs in the background, checking for due tasks and dispatching them at the configured intervals.

### ImageService

Image store management, egg configuration, and variable handling. Eggs define server types (Minecraft, Node.js, etc.) with their associated startup commands, Docker images, and install scripts. Variables let users configure egg-specific settings per server. Manages the relationship between eggs, nests, and service categories.

### AddonService

Addon loading, registration, and lifecycle management. Discovers installed addons, registers their routes and middleware, and manages their initialization and shutdown. Addons extend panel functionality without modifying core code.

### FileService

File operations proxied to the daemon. Handles file listing, reading, writing, deleting, moving, copying, and compression/decompression. All file operations happen on the node where the server runs, not on the panel itself.

### ConsoleService

WebSocket console connections and event streaming. Manages real-time terminal access to servers through the daemon. Streams console output, connection status, and server events to connected clients. Handles authentication and heartbeat for persistent connections.

### ActivityService

Audit logging and analytics. Records significant actions (server creation, power actions, user changes) with timestamps, user IDs, and metadata. Provides query interfaces for activity history and analytics dashboards.

### SettingsService

Panel settings and feature toggles. Reads and writes panel-wide configuration. Manages feature flags that enable or disable functionality. Exposes settings to other services and the frontend.

### LocationService

Geographic location management for nodes. Stores and retrieves location metadata (city, country, coordinates) used for node selection and display.

### AllocationService

Port allocation and assignment on nodes. Manages the pool of available ports per node, assigns ports to servers, and handles deallocation when servers are deleted. Ensures no port conflicts across the panel.

## Service Patterns

### Dependency Injection

Services receive their dependencies through constructor parameters. Each service declares what it needs (database client, daemon client, queue manager) and the dependency container or application bootstrapper wires them together. This avoids singletons and makes services testable.

### Database Access

All database queries go through Prisma. Services import the Prisma client and use its generated query methods. No raw SQL outside of specific migrations or performance-critical paths. Transactions wrap multi-step operations that must be atomic.

### Daemon Communication

Services talk to node daemons over HTTP. A shared HTTP client handles authentication, timeouts, and retries. Daemon endpoints return JSON payloads that services parse and validate before returning to callers.

### Event Emission

Services emit events after significant state changes. The event system notifies WebSocket clients, activity loggers, and any subscribers interested in those changes. Events use a pub/sub pattern so services do not need direct references to their consumers.

## Queue System

### Background Job Processing

Long-running or resource-heavy operations run as background jobs. The queue system serializes jobs, tracks their status, and handles failures. Jobs are defined as classes with a handle method that contains the work to execute.

### Job Types

- **Install**: Runs egg install scripts on the daemon after server creation.
- **Reinstall**: Re-runs install scripts for an existing server.
- **Backup**: Creates a compressed archive of server files and uploads to S3.
- **Restore**: Downloads a backup from S3 and extracts it onto a server.

### Concurrency Limits

Each job type defines a concurrency limit to prevent resource exhaustion. The queue processor respects these limits, deferring excess jobs until slots free up. This prevents a burst of installs from overwhelming a single node.

### Retry Logic

Failed jobs retry up to a configured maximum with exponential backoff. Jobs that exceed the retry limit move to a failed state and require manual intervention. Retry counts and failure reasons are stored for debugging.

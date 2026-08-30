# Console and Logs

## Server Console

The console provides real-time output from game server containers via WebSocket.

### WebSocket Connection

Connect to the panel's WebSocket endpoint with session authentication. The console module (`src/modules/user/serverConsole.ts`) handles:

- Streaming container stdout/stderr to the browser
- Sending commands to the container stdin
- Connection management and cleanup

### Console Permissions

- `console` (view console output)
- `console.send` (send commands to the console)

### Power Actions via Console

The console page also provides power controls (start, stop, restart, kill) with the same permission checks as the API.

## Server Logs

The logs page (`views/user/server/logs.ejs`) provides access to server log files. Logs are fetched from the daemon's file API and displayed in the browser.

### Log Access

Logs are typically read from common log paths within the server directory. The exact paths depend on the server's image definition and configuration.

## Activity Logs

The panel maintains an activity log for audit purposes. Every significant action is recorded with:

- Who performed it (actor ID)
- What server it relates to (if applicable)
- Event type (e.g., `server.power.start`)
- Additional metadata as JSON
- IP address
- Timestamp

Activity logs are viewable in the admin panel under Activity. They cannot be modified or deleted by users.

## Daemon Logs

Panel-level logs are handled by the logger service (`src/handlers/logger.ts`). Logs are written to the console and can be redirected to files via standard Node.js mechanisms.

### Log Levels

- `error` (errors and exceptions)
- `warn` (warnings)
- `info` (general information)
- `debug` (debug output)

## Real-time Updates

The WebSocket server pushes real-time updates to connected browsers:

- Console output lines
- Server status changes
- Activity notifications

See [api/webhooks.md](../api/webhooks.md) for the full event reference.

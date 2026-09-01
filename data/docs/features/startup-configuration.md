---
title: "Startup Configuration"
section: "Features"
order: 26
description: "Configure server startup variables and commands."
---

## Startup Configuration

Startup configuration controls how a server process is launched. This includes the Docker image, start command, port bindings, and environment variables.

## Startup Variables

Variables are key-value pairs resolved at runtime when the server starts. They replace placeholders in the start command and other configuration fields.

Variables are defined by the egg and can be overridden per-server. Each variable has:

- **Name**: The key (e.g., `SERVER_PORT`).
- **Default value**: Used if the server owner does not set one.
- **Environment variable**: The actual env var injected into the container.
- **Input type**: How the panel presents the field (text, number, boolean, etc.).
- **Required**: Whether the variable must have a value.

When the server starts, the panel resolves all variables and substitutes them into the start command string.

## Egg Variables

Each egg defines its own set of variables. For example, a Minecraft egg includes `SERVER_JARFILE`, `MEMORY`, and `JAVA_VERSION`. These are specific to the software the egg supports.

You can add custom variables to a server beyond what the egg defines. These are stored as server-level environment variables.

## Docker Image

The Docker image is set by the egg. It determines the base environment the server runs in. Examples:

- `quay.io/pterodactyl/yolks:java_17` for Java servers.
- `quay.io/pterodactyl/yolks:node_18` for Node.js servers.
- `quay.io/pterodactyl/yolks:python_3` for Python servers.

You can override the Docker image per-server if the egg's default does not match your needs. The image must be a valid Docker Hub or registry image.

## Start Command

The start command is the shell command executed inside the container. It uses `{` and `}` to reference variables:

```
java -Xms{SERVER_MEMORY}M -Xmx{SERVER_MEMORY}M -jar {SERVER_JARFILE} nogui
```

At start time, the panel replaces `{SERVER_MEMORY}` and `{SERVER_JARFILE}` with their resolved values.

If the start command contains no variable references, it is run as-is.

## Port Allocation

Each server needs at least one port. Ports are allocated from the server's allocation list and injected as the `SERVER_PORT` variable (and `SERVER_HOST` for the IP).

Port allocation is automatic unless you manually assign specific ports. The panel ensures no two servers share the same external port on the same node.

## Environment Variables

All resolved variables are injected into the container as environment variables. The process can read them with standard env var access:

- Linux: `$SERVER_PORT`
- Java: `System.getenv("SERVER_PORT")`
- Node.js: `process.env.SERVER_PORT`
- Python: `os.environ["SERVER_PORT"]`

Sensitive values (RCON passwords, API keys) should be marked as "hidden" in the variable definition so they do not appear in the panel UI after being set.

---
title: "About AirLink"
section: "Project"
order: 1
description: "AirLink team, contributors, and project history."
---

## What is AirLink

AirLink is an open-source, self-hosted game server management panel. It gives operators full control over their game servers through a clean web interface. MIT licensed, no vendor lock-in, your servers your rules.

Built by operators, for operators.

## Team

- **privt** — Owner. Project founder and oversight.
- **thavanish** — Maintainer. Core panel and daemon development.
- **achul** — Old maintainer. Set up the original project architecture and infrastructure.

## Community Contributors

AirLink exists because of the people who use it and give back. Features, bug fixes, documentation, addons — none of it happens in a vacuum.

Thanks to everyone who has opened a PR, reported a bug, wrote docs, or built an addon. You keep this project alive.

## Project History

AirLink started as a simple Express + EJS panel. It worked, but it didn't scale well. The whole thing got rewritten to a modular architecture that separates concerns properly.

The daemon — the piece that actually manages game servers — was originally Node.js. It's now Bun. Faster startup, lower memory usage, better for the kind of work a daemon does.

Current versions: Panel 2.5.x, Daemon 3.0.x.

## Open Source

MIT License. Use it, modify it, deploy it, fork it. Just keep the license.

GitHub: [github.com/airlinklabs](https://github.com/airlinklabs)

Want to contribute? Check the [contributing guide](https://github.com/airlinklabs/airlink/blob/main/CONTRIBUTING.md).

# AirLink Panel — Announcements

##  We're Entering Public Testing!


After months of development, we're excited to announce that **AirLink Panel is officially entering public testing**.

This is a big milestone for us. AirLink started as a project to build a game server management panel that actually makes sense — clean codebase, a proper addon system, and no bloat. Today, we're opening it up to the community to put it through its paces.

### What's in the testing build?

- **Full server management** — deploy, start, stop, and monitor game servers in real time
- **User & permission system** — admin controls, sub-user access, and session-based auth
- **Addon architecture** — extend the panel without touching core code
- **Database migrations** — addons manage their own schema automatically
- **REST API** — everything the panel does is available through the API
- **Community addons** — Modrinth Store and Parachute are available to install today

### What we need from you

Testing means finding the things we haven't found yet. If you run into bugs, unexpected behavior, or something that just feels off — please open an issue on [GitHub](https://github.com/AirlinkLabs/panel/issues). The more specific the report, the faster we can fix it.

If you're a developer, we'd especially love feedback on the addon API. Build something small, see where the rough edges are, and let us know.

### Known limitations

This is a beta. A few things to keep in mind going in:

- Some UI flows are still being polished
- Documentation is actively being written — you're reading part of it right now
- Breaking changes to the addon API may still happen before stable release

### How to get started

The fastest path is the one-command installer:

```bash
bash <(curl -s https://raw.githubusercontent.com/airlinklabs/panel/refs/heads/main/installer.sh)
```

Or follow the manual install steps in the [Quick Start guide](https://airlinklabs.github.io/panel-docs/docs/quickstart/).

### Stay in the loop

Join the [Discord](https://discord.gg/D8YbT9rDqz) — that's where we post updates, discuss feedback, and generally hang out. This announcements page will also be updated as things progress toward stable.

Thanks for being here early. It means a lot.

— **The AirLink Team**

---

*This site and the panel itself are under active development. Expect things to change.*

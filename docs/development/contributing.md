# Contributing

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm
- PostgreSQL 14+
- Redis 6+

### Getting Started

```bash
git clone https://github.com/airlinklabs/panel.git
cd panel
cp example.env .env    # configure database
pnpm install
pnpm run dev
```

The dev command runs:

- Prisma generate + db push
- Tailwind CSS in watch mode
- Nodemon for auto-restart on code changes

### Project Structure

```
panel/
├── src/
│   ├── modules/           # Feature modules (routes)
│   │   ├── admin/         # Admin panel routes
│   │   ├── api/           # API routes
│   │   │   └── v2/        # V2 REST API
│   │   ├── auth/          # Authentication
│   │   ├── core/          # Core middleware
│   │   ├── realtime/      # WebSocket
│   │   └── user/          # User-facing routes
│   ├── services/          # Business logic
│   ├── handlers/          # Middleware and utilities
│   ├── utils/             # Helper functions
│   └── db.ts              # Prisma client
├── views/                 # EJS templates
│   ├── admin/             # Admin pages
│   ├── user/              # User pages
│   ├── auth/              # Auth pages
│   └── components/        # Shared components
├── public/                # Static assets
├── storage/
│   └── prisma/
│       └── schema.prisma  # Database schema
└── tests/                 # Test files
```

See [project-structure.md](project-structure.md) for the full breakdown.

### Running Tests

```bash
pnpm run test          # Run once
pnpm run test:watch    # Watch mode
```

### Linting and Formatting

```bash
pnpm run lint         # ESLint with auto-fix
pnpm run format       # Prettier
```

### Type Checking

```bash
pnpm run typecheck
```

## Code Style

- TypeScript strict mode
- ESM modules
- Express routers for routes
- Zod for validation
- Prisma for database access
- EJS for templates.

## Adding a Feature

1. Create a module file in `src/modules/`
2. Export a `Module` object with `info` and `router`
3. Register in `src/modules/registry.ts`
4. Add any new Prisma models to `schema.prisma`
5. Run `pnpm run migrate:dev`

## Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Run tests and type check
5. Submit a PR with a clear description.

## License

MIT. Same as the main project.

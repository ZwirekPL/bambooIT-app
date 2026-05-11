DietetykDEV – Development Rules 0. General Principles

Write all code and comments in English.

Business/domain discussions are in Polish.

Prefer small, modular files (avoid files >1000 lines).

Do not generate new scaffolding if project structure already exists.

Always analyze existing code before proposing changes.

1. Environment Modes
   DEV

Backend runs locally (npm run dev).

PostgreSQL and Redis run in Docker.

Use local .env (never commit it).

PROD-LIKE

Application runs inside Docker (multi-stage build).

NODE_ENV=production.

Never mix production secrets with development environment.

2. Environment Variables & Secrets

.env must never be committed.

.env.example must always be up to date.

All required environment variables must be validated at startup.

If a required variable is missing → application must exit with clear error.

3. Monorepo Rules

Shared database logic only inside packages/database.

Import DB client only via alias (@db).

Avoid cross-dependencies between apps unless necessary.

Avoid circular dependencies.

4. Prisma & Database

Any change in schema.prisma requires migration + prisma generate.

Never manually modify production database.

Seed scripts must be idempotent.

Do not log raw medical or interview data.

5. API & Validation

Every endpoint must validate input (Zod or equivalent).

Never trust AI output — validate and sanitize before saving.

Use consistent error format:

{
"error": {
"code": "ERROR_CODE",
"message": "Human readable message"
}
}

Do not expose internal stack traces in production.

6. Logging & Sensitive Data

Never log:

full medical interviews

diet plan content

API keys

Mask sensitive fields (email, phone).

Use structured logging (info/warn/error).

7. Docker

Use multi-stage builds for production.

Do not install devDependencies in production image.

Keep container startup deterministic.

8. AI & n8n Integration

Treat n8n as external service.

Implement timeout handling.

Validate AI response before DB write.

Avoid storing raw prompts with personal health data.

9. Git & Commits

Every development step ends with a commit.

Commit messages must be in English.

Preferred formats:

stepXX: short description
or
feat(scope): description

No unfinished TODOs without reference:

// TODO(#123): description

10. TypeScript

Avoid @ts-ignore.

If absolutely necessary, use:

@ts-expect-error // explanation

Do not bypass types without justification.

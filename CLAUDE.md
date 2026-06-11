# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
bun install

# Run the server
bun run index.ts

# Generate Prisma client after schema changes
bunx prisma generate

# Run database migrations
bunx prisma migrate dev

# Run a one-off script
bun run src/scripts/<script-name>.ts
```

There are no tests configured in this project.

## Architecture

This is a **Bun + Express + TypeScript** REST API backend for "Way to India" (WTI), a travel tour platform.

### Route Structure

All routes are mounted under three top-level prefixes defined in `src/routes/index.ts`:
- `/api/user` — end-user facing routes (auth, reviews, tour queries, verification)
- `/api/admin` — admin panel routes (tours, leads CRM, hero slides, blogs, travel guide, POI, RBAC)
- `/api/common` — shared public routes (tours listing, cities, themes, POI, travel guide, hero slides)

Route names are centralized in `src/common/appRoutes.ts`.

### Layered Pattern

Each feature follows a strict three-layer pattern:
1. **Validator** (`src/validators/`) — Zod schemas, validated via `src/middlewares/validation.middleware.ts`
2. **Controller** (`src/controllers/<scope>/`) — handles HTTP req/res, calls service
3. **Service** (`src/services/<scope>/`) — business logic, interacts with Prisma

Scopes: `admin/`, `user/`, `common/`, `ai/`

### Response Convention

Every response uses the custom `res.deliver(code, status, payload?, message?)` method defined in `src/middlewares/handlers/responseHandler.ts` and typed in `src/typings/index.d.ts`. Always use this instead of `res.json()`.

### Error Handling

Throw typed errors from `src/middlewares/handlers/errorHandler.ts`:
- `BadRequestError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `InternalServerError`, `UnprocessableEntityError`

### Database

Prisma client is in `prisma/generated/prisma/` (custom output path). Import from `@/config/db` — this exports an extended PrismaClient that **automatically patches all S3 URLs to CloudFront URLs** via `patchCloudFrontURLs` on every read operation.

### Path Aliases

`@/*` maps to `./src/*` (configured in `tsconfig.json`).

### Auth & Permissions

- **User auth**: Bearer JWT via `src/middlewares/user/auth.middleware.ts` — sets `req.user`
- **Admin auth**: Separate JWT flow — sets `req.admin` with `roleId`
- **RBAC**: `checkPermission(moduleName, action)` middleware in `src/middlewares/permission.middleware.ts` — checks `Permission` table for `view|create|edit|delete` per module per role

### Caching

Redis cache middleware in `src/middlewares/cache.middleware.ts` — use `cache({ ttl, keyPrefix })` to cache GET responses, `clearCache(pattern)` to invalidate. Redis config at `src/config/redis.ts`.

### File Uploads

Multer middleware at `src/middlewares/multer.ts` (tours/general) and `src/middlewares/review.multer.ts` (reviews). Files are uploaded to AWS S3 via `src/services/common/s3.service.ts`.

### AI Integration

`src/services/ai/ai-funnel.service.ts` uses `@anthropic-ai/sdk` (Claude) for lead qualification, follow-up suggestions, and daily sales briefings within the CRM. Model: `claude-sonnet-4-5-20250929`.

### Key Domain Models

- **Tour** — core product with itinerary, cities, themes, price guide, FAQs, reviews
- **TourDraft** — JSON blob for in-progress tour creation by admins
- **Lead** — full CRM lead with status pipeline, activities, notes, quotations, communications, reminders
- **Admin** — staff users with Role-based permissions (Role → Permission → Module)
- **User** — end customers with email/phone verification via `VerificationSession`
- **PoiMonument / PoiCity / PoiState** — points of interest data
- **TravelGuideData** — rich city content for travel guides

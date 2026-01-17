# Way to India - Backend Documentation

## Table of Contents

- [Project Overview](#project-overview)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Architecture](#api-architecture)
- [Key Features](#key-features)
- [Setup Instructions](#setup-instructions)
- [Development Workflows](#development-workflows)

---

## Project Overview

The Way to India backend is a RESTful API server built with **Bun** and **Express**, providing endpoints for the public website and admin panel. It handles tour management, user authentication, CRM operations, travel guides, and more.

### Architecture Pattern

- **MVC with Service Layer**: Controllers handle requests, services contain business logic, and Prisma manages data access
- **Three API Namespaces**: `/api/user`, `/api/admin`, `/api/common`
- **Middleware-based**: Authentication, error handling, rate limiting, and response formatting

---

## Technology Stack

| Technology        | Purpose                                  |
| ----------------- | ---------------------------------------- |
| **Bun**           | JavaScript runtime (faster than Node.js) |
| **Express 5**     | Web framework for routing and middleware |
| **Prisma 6**      | ORM for PostgreSQL database              |
| **PostgreSQL**    | Primary database                         |
| **Redis/IORedis** | Caching and session management           |
| **AWS S3**        | File storage for images and documents    |
| **Resend**        | Email service                            |
| **Zod**           | Schema validation                        |
| **JWT**           | Authentication tokens                    |
| **Bcrypt**        | Password hashing                         |
| **Sharp**         | Image processing                         |
| **Multer**        | File upload handling                     |

---

## Project Structure

```
way-india-backend-main/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── generated/             # Prisma client
├── src/
│   ├── config/                # Configuration files
│   ├── constants/             # App constants
│   ├── controllers/           # Request handlers
│   │   ├── admin/            # Admin controllers
│   │   ├── common/           # Public controllers
│   │   └── user/             # User controllers
│   ├── routes/               # API routes
│   │   ├── admin/            # Admin routes
│   │   ├── common/           # Public routes
│   │   ├── user/             # User routes
│   │   └── index.ts          # Route aggregator
│   ├── services/             # Business logic
│   │   ├── admin/            # Admin services
│   │   ├── common/           # Shared services
│   │   └── user/             # User services
│   ├── middlewares/          # Express middleware
│   │   ├── handlers/         # Response/error handlers
│   │   ├── auth.ts           # Authentication
│   │   ├── adminAuth.ts      # Admin authentication
│   │   └── error.ts          # Error middleware
│   ├── utils/                # Utility functions
│   ├── validators/           # Zod schemas
│   ├── helpers/              # Helper functions
│   ├── types/                # TypeScript types
│   └── scripts/              # Utility scripts
├── index.ts                  # Server entry point
└── package.json
```

### Key Directories Explained

#### **Controllers** (`src/controllers/`)

Handle HTTP requests and responses. Organized by API namespace:

**Admin Controllers:**

- `admin.controller.ts` - Admin CRUD operations
- `auth.controller.ts` - Admin authentication
- `dashboard.controller.ts` - Dashboard statistics
- `lead-crm.controller.ts` - CRM lead management
- `tour.controller.ts` - Tour management (admin)
- `travel-guide.controller.ts` - Travel guide management
- `poi.controller.ts` - Points of Interest management
- `hero-slide.controller.ts` - Homepage carousel
- `user.controller.ts` - User management
- `role.controller.ts` - Role management
- `permission.controller.ts` - Permission management
- `module.controller.ts` - Module management

**Common Controllers:**

- `tour.controller.ts` - Public tour endpoints
- `poi.controller.ts` - Public POI endpoints
- `city.controller.ts` - City data
- `theme.controller.ts` - Tour themes
- `hero-slide.controller.ts` - Public hero slides
- `travel-guide.controller.ts` - Public travel guides
- `query.controller.ts` - Contact/query forms

**User Controllers:**

- `auth.controller.ts` - User authentication
- `review.controller.ts` - Tour reviews
- `tour-query.controller.ts` - Tour inquiries

#### **Routes** (`src/routes/`)

Define API endpoints and map them to controllers. Each route file corresponds to a feature area.

#### **Services** (`src/services/`)

Contain business logic and database operations. Services are called by controllers to keep controllers thin.

#### **Middlewares** (`src/middlewares/`)

- `auth.ts` - Verify user JWT tokens
- `adminAuth.ts` - Verify admin JWT tokens with role permissions
- `responseHandler.ts` - Standardize API responses
- `errorHandler.ts` - Centralized error handling
- `error.ts` - Error middleware

---

## Database Schema

### Core Models

#### **User Management**

- `User` - Customer accounts with authentication
- `Admin` - Admin users with role-based access
- `Role` - Admin roles (e.g., Super Admin, Sales Admin)
- `Module` - System modules (e.g., Tours, CRM, Users)
- `Permission` - Role-module permissions (view, create, edit, delete)

#### **Tour Management**

- `Tour` - Tour packages with pricing, itinerary, images
- `TourItinerary` - Day-by-day tour plans
- `TourPriceGuide` - Price breakdown items
- `TourCity` - Cities included in tours
- `TourTheme` - Tour categories (Adventure, Cultural, etc.)
- `Theme` - Theme master data
- `City` - City master data
- `Faq` - Tour FAQs
- `FaqQuestion` - FAQ questions and answers
- `TourReview` - User reviews for tours
- `ReviewImage` - Review images

#### **CRM System**

- `Lead` - Customer leads with status tracking
- `LeadTag` - Lead categorization tags
- `LeadCategory` - Lead categories
- `LeadSourceMaster` - Lead source configuration
- `LeadActivity` - Lead activity log
- `LeadStatusHistory` - Status change tracking
- `LeadNote` - Internal notes on leads
- `LeadQuotation` - Quotation documents
- `LeadCommunication` - Communication history (calls, emails, WhatsApp)
- `LeadReminder` - Follow-up reminders

#### **Travel Guide**

- `TravelGuideState` - Indian states
- `TravelGuideCity` - Cities within states
- `TravelGuideData` - Detailed city information (facts, dining, shopping, etc.)

#### **Points of Interest (POI)**

- `PoiState` - States for POI
- `PoiCity` - Cities for POI
- `PoiCategory` - POI categories
- `PoiMetadata` - Additional POI data

#### **Other**

- `HeroSlide` - Homepage carousel slides

### Key Relationships

- Tours ↔ Cities (many-to-many via `TourCity`)
- Tours ↔ Themes (many-to-many via `TourTheme`)
- Leads ↔ Admin (assigned admin)
- Admin ↔ Role (role-based permissions)
- Role ↔ Module (permissions via `Permission`)

---

## API Architecture

### API Namespaces

```
/api/user      → User-facing endpoints (authentication, reviews, queries)
/api/admin     → Admin panel endpoints (requires admin authentication)
/api/common    → Public endpoints (tours, cities, themes, travel guides)
```

### Admin API (`/api/admin`)

**Authentication:**

- `POST /api/admin/auth/login` - Admin login
- `POST /api/admin/auth/refresh` - Refresh access token
- `POST /api/admin/auth/logout` - Logout

**Dashboard:**

- `GET /api/admin/dashboard/stats` - Dashboard statistics

**CRM - Leads:**

- `GET /api/admin/crm/leads` - List all leads (with filters, sorting, pagination)
- `GET /api/admin/crm/leads/:id` - Get lead details
- `POST /api/admin/crm/leads` - Create new lead
- `PUT /api/admin/crm/leads/:id` - Update lead
- `DELETE /api/admin/crm/leads/:id` - Delete lead
- `PATCH /api/admin/crm/leads/:id/status` - Update lead status
- `PATCH /api/admin/crm/leads/:id/assign` - Assign lead to admin
- `PATCH /api/admin/crm/leads/:id/priority` - Update priority

**CRM - Activities:**

- `GET /api/admin/crm/leads/:id/activities` - Get lead activities
- `POST /api/admin/crm/leads/:id/activities` - Add activity

**CRM - Notes:**

- `GET /api/admin/crm/leads/:id/notes` - Get lead notes
- `POST /api/admin/crm/leads/:id/notes` - Add note
- `PUT /api/admin/crm/notes/:id` - Update note
- `DELETE /api/admin/crm/notes/:id` - Delete note

**CRM - Quotations:**

- `GET /api/admin/crm/leads/:id/quotations` - Get quotations
- `POST /api/admin/crm/leads/:id/quotations` - Upload quotation
- `DELETE /api/admin/crm/quotations/:id` - Delete quotation

**CRM - Communications:**

- `GET /api/admin/crm/leads/:id/communications` - Get communications
- `POST /api/admin/crm/leads/:id/communications` - Log communication

**CRM - Reminders:**

- `GET /api/admin/crm/reminders` - Get all reminders
- `GET /api/admin/crm/leads/:id/reminders` - Get lead reminders
- `POST /api/admin/crm/leads/:id/reminders` - Create reminder
- `PATCH /api/admin/crm/reminders/:id/complete` - Mark complete
- `PATCH /api/admin/crm/reminders/:id/snooze` - Snooze reminder

**CRM - Configuration:**

- `GET /api/admin/crm/tags` - Get all tags
- `POST /api/admin/crm/tags` - Create tag
- `PUT /api/admin/crm/tags/:id` - Update tag
- `DELETE /api/admin/crm/tags/:id` - Delete tag

**Tours:**

- `GET /api/admin/tours` - List tours (with filters, sorting, pagination)
- `GET /api/admin/tours/:id` - Get tour details
- `POST /api/admin/tours` - Create tour
- `PUT /api/admin/tours/:id` - Update tour
- `DELETE /api/admin/tours/:id` - Delete tour

**Travel Guide:**

- `GET /api/admin/travel-guide/states` - List states
- `POST /api/admin/travel-guide/states` - Create state
- `PUT /api/admin/travel-guide/states/:id` - Update state
- `DELETE /api/admin/travel-guide/states/:id` - Delete state
- `GET /api/admin/travel-guide/cities` - List cities
- `POST /api/admin/travel-guide/cities` - Create city
- `PUT /api/admin/travel-guide/cities/:id` - Update city
- `DELETE /api/admin/travel-guide/cities/:id` - Delete city
- `GET /api/admin/travel-guide/data` - List guide data
- `POST /api/admin/travel-guide/data` - Create guide data
- `PUT /api/admin/travel-guide/data/:id` - Update guide data
- `DELETE /api/admin/travel-guide/data/:id` - Delete guide data

**Users:**

- `GET /api/admin/users` - List users
- `GET /api/admin/users/:id` - Get user details
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `POST /api/admin/users/send-email` - Send email to users

**Admins:**

- `GET /api/admin/admins` - List admins
- `POST /api/admin/admins` - Create admin
- `PUT /api/admin/admins/:id` - Update admin
- `DELETE /api/admin/admins/:id` - Delete admin

**Roles & Permissions:**

- `GET /api/admin/roles` - List roles
- `POST /api/admin/roles` - Create role
- `PUT /api/admin/roles/:id` - Update role
- `DELETE /api/admin/roles/:id` - Delete role
- `GET /api/admin/permissions` - Get permissions
- `PUT /api/admin/permissions/:roleId` - Update role permissions
- `GET /api/admin/modules` - List modules

**Hero Slides:**

- `GET /api/admin/hero-slides` - List hero slides
- `POST /api/admin/hero-slides` - Create hero slide
- `PUT /api/admin/hero-slides/:id` - Update hero slide
- `DELETE /api/admin/hero-slides/:id` - Delete hero slide
- `PATCH /api/admin/hero-slides/reorder` - Reorder slides

**POI (Points of Interest):**

- `GET /api/admin/poi/states` - List POI states
- `GET /api/admin/poi/cities` - List POI cities
- `GET /api/admin/poi/categories` - List POI categories
- `POST /api/admin/poi/import` - Import POI data

### Common API (`/api/common`)

**Tours:**

- `GET /api/common/tours` - List tours (public, with filters)
- `GET /api/common/tours/:slug` - Get tour by slug
- `GET /api/common/tours/:id/reviews` - Get tour reviews

**Cities & Themes:**

- `GET /api/common/cities` - List cities
- `GET /api/common/cities/:slug` - Get city by slug
- `GET /api/common/themes` - List themes
- `GET /api/common/themes/:slug` - Get theme by slug

**Travel Guide:**

- `GET /api/common/travel-guide/states` - List states
- `GET /api/common/travel-guide/cities` - List cities
- `GET /api/common/travel-guide/data` - Get guide data

**POI:**

- `GET /api/common/poi/states` - List POI states
- `GET /api/common/poi/cities` - List POI cities
- `GET /api/common/poi/categories` - List POI categories

**Hero Slides:**

- `GET /api/common/hero-slides` - Get active hero slides

**Queries:**

- `POST /api/common/queries/tour` - Submit tour query
- `POST /api/common/queries/hotel` - Submit hotel query
- `POST /api/common/queries/transport` - Submit transport query
- `POST /api/common/queries/contact` - Submit contact form

### User API (`/api/user`)

**Authentication:**

- `POST /api/user/auth/register` - User registration
- `POST /api/user/auth/login` - User login
- `POST /api/user/auth/refresh` - Refresh token
- `POST /api/user/auth/logout` - Logout

**Reviews:**

- `POST /api/user/review` - Create tour review
- `PUT /api/user/review/:id` - Update review
- `DELETE /api/user/review/:id` - Delete review

**Tour Queries:**

- `POST /api/user/tour-query` - Submit tour inquiry

---

## Key Features

### 1. CRM System

A comprehensive lead management system with:

- **Lead Tracking**: Status, priority, quality, source tracking
- **Assignment**: Assign leads to admins
- **Activities**: Log all lead interactions
- **Notes**: Internal notes with attachments
- **Quotations**: Upload and track quotation documents
- **Communications**: Track calls, emails, WhatsApp, meetings
- **Reminders**: Follow-up reminders with snooze functionality
- **Status History**: Complete audit trail of status changes

### 2. Tour Management

- Full CRUD operations for tours
- Rich tour details (itinerary, pricing, images, FAQs)
- Theme and city associations
- Review system with ratings
- View and booking count tracking
- Featured tours

### 3. Travel Guide System

- Hierarchical structure: States → Cities → Guide Data
- Comprehensive city information (facts, dining, shopping, culture, etc.)
- Best time to visit, places to see, hotel details

### 4. Authentication & Authorization

- **User Authentication**: JWT-based with refresh tokens
- **Admin Authentication**: JWT with role-based access control (RBAC)
- **Permissions**: Granular module-level permissions (view, create, edit, delete)

### 5. File Management

- AWS S3 integration for image and document storage
- Image optimization with Sharp
- Presigned URLs for secure file access

### 6. Email Service

- Resend integration for transactional emails
- Admin can send custom emails to users

---

## Setup Instructions

### Prerequisites

- **Bun** v1.2.2 or higher
- **PostgreSQL** database
- **Redis** server (optional, for caching)
- **AWS S3** account (for file storage)
- **Resend** account (for emails)

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server
PORT=5000
NODE_ENV=development
MAINTENANCE_MODE=false

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/way_india"

# JWT Secrets
JWT_SECRET="your-jwt-secret"
JWT_REFRESH_SECRET="your-refresh-secret"
ADMIN_JWT_SECRET="your-admin-jwt-secret"
ADMIN_JWT_REFRESH_SECRET="your-admin-refresh-secret"

# AWS S3
AWS_REGION="ap-south-1"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_S3_BUCKET_NAME="your-bucket-name"
AWS_S3_BASE_URL="https://your-bucket.s3.amazonaws.com"

# Redis (optional)
REDIS_URL="redis://localhost:6379"

# Resend Email
RESEND_API_KEY="your-resend-api-key"
RESEND_FROM_EMAIL="noreply@yourdomain.com"

# CORS
CORS_ORIGIN="http://localhost:3000"
```

### Installation Steps

1. **Install dependencies:**

   ```bash
   bun install
   ```

2. **Setup database:**

   ```bash
   # Generate Prisma client
   bunx prisma generate

   # Run migrations
   bunx prisma migrate dev

   # (Optional) Seed data
   bunx prisma db seed
   ```

3. **Start development server:**

   ```bash
   bun run index.ts
   ```

4. **Open Prisma Studio** (database GUI):
   ```bash
   bunx prisma studio
   ```

### Available Scripts

```json
{
  "start": "bun run index.ts",
  "backup:db": "bun run scripts/backup-database.ts",
  "backup:restore": "bun run scripts/restore-database.ts",
  "import:poi": "bun run scripts/import-poi-data.ts"
}
```

---

## Development Workflows

### Adding a New API Endpoint

1. **Create/Update Controller** (`src/controllers/[namespace]/feature.controller.ts`):

   ```typescript
   export const getItems = async (req: Request, res: Response) => {
     try {
       const items = await ItemService.getAll();
       res.deliver(200, true, items, 'Items fetched successfully');
     } catch (error) {
       throw new InternalServerError('Failed to fetch items');
     }
   };
   ```

2. **Create/Update Service** (`src/services/[namespace]/feature.service.ts`):

   ```typescript
   export class ItemService {
     static async getAll() {
       return await prisma.item.findMany({
         where: { isActive: true },
         orderBy: { createdAt: 'desc' },
       });
     }
   }
   ```

3. **Create/Update Route** (`src/routes/[namespace]/feature.routes.ts`):

   ```typescript
   import { Router } from 'express';
   import { getItems } from '@/controllers/admin/feature.controller';
   import { adminAuth } from '@/middlewares/adminAuth';

   const router = Router();

   router.get('/items', adminAuth(['items'], 'view'), getItems);

   export default router;
   ```

4. **Register Route** in `src/routes/[namespace]/index.ts`:

   ```typescript
   import featureRoutes from './feature.routes';

   router.use('/feature', featureRoutes);
   ```

### Creating Database Migrations

1. **Update Prisma schema** (`prisma/schema.prisma`):

   ```prisma
   model NewModel {
     id        String   @id @default(cuid())
     name      String
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt

     @@map("new_models")
   }
   ```

2. **Create migration:**

   ```bash
   bunx prisma migrate dev --name add_new_model
   ```

3. **Generate Prisma client:**
   ```bash
   bunx prisma generate
   ```

### Authentication Middleware Usage

**User Authentication:**

```typescript
import { auth } from '@/middlewares/auth';

router.get('/profile', auth, getProfile);
```

**Admin Authentication with Permissions:**

```typescript
import { adminAuth } from '@/middlewares/adminAuth';

// Check if admin has 'view' permission for 'tours' module
router.get('/tours', adminAuth(['tours'], 'view'), getTours);

// Check if admin has 'create' permission for 'tours' module
router.post('/tours', adminAuth(['tours'], 'create'), createTour);
```

### Response Format

All API responses use a standardized format via `res.deliver()`:

```typescript
res.deliver(statusCode, success, data, message);

// Success example
res.deliver(200, true, { tours: [...] }, "Tours fetched successfully");

// Error example (handled by error middleware)
throw new BadRequestError("Invalid tour ID");
```

### Error Handling

Use custom error classes:

```typescript
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  InternalServerError,
} from '@/middlewares/handlers/errorHandler';

throw new NotFoundError('Tour not found');
throw new BadRequestError('Invalid input data');
throw new UnauthorizedError('Invalid credentials');
```

---

## Additional Notes

### Rate Limiting

- Global rate limit: 300 requests per 15 minutes
- Configured in `index.ts`

### CORS

- Configured to accept requests from frontend origins
- Credentials enabled for cookie-based authentication

### File Uploads

- Handled via Multer middleware
- Files uploaded to AWS S3
- Images optimized with Sharp before upload

### Caching

- Redis used for session management and caching
- Can be extended for API response caching

---

**For questions or issues, refer to the codebase or contact the development team.**

# Way to India - Backend Documentation (Part 2)

> **Continuation of Comprehensive Developer Guide**

---

## Technology Stack

### Core Technologies

#### Runtime & Framework

- **Bun v1.2.2+** - Fast JavaScript runtime (alternative to Node.js)
  - Used for running the application and managing dependencies
  - Significantly faster than npm for package installation
  - Native TypeScript support without extra configuration

- **Express.js v5.2.1** - Web application framework
  - Handles HTTP requests and routing
  - Middleware-based architecture
  - Extended with custom response handler

- **TypeScript** - Type-safe JavaScript
  - Ensures code quality and catches errors at compile time
  - Better IDE support and autocomplete
  - Configured with `tsconfig.json`

#### Database & ORM

- **PostgreSQL** - Primary database (hosted on Supabase)
  - Relational database for structured data
  - ACID compliant for data integrity
  - Supports complex queries and relationships

- **Prisma ORM v6** - Database toolkit
  - Type-safe database client
  - Automatic migrations
  - Schema-first development
  - Query builder with excellent TypeScript support
  ```typescript
  // Example Prisma query
  const tours = await prisma.tour.findMany({
    where: { isActive: true },
    include: { cities: true, themes: true },
    orderBy: { rating: 'desc' },
  });
  ```

#### Caching

- **Redis** - In-memory data store
  - **Package**: `ioredis` v5.8.2
  - Used for caching frequently accessed data
  - Session storage
  - Rate limiting implementation
  ```typescript
  // Cache example
  const cachedTour = await redis.get(`tour:${slug}`);
  if (cachedTour) return JSON.parse(cachedTour);
  ```

### Authentication & Security

- **jsonwebtoken v9.0.3** - JWT token generation and verification
  - Access tokens (1 hour expiry)
  - Refresh tokens (7 days expiry)
  - Payload includes user/admin ID, email, role

- **bcrypt v6.0.0** - Password hashing
  - 10 salt rounds for secure hashing
  - One-way encryption (cannot be reversed)
  - Industry-standard password security

- **express-rate-limit v8.2.1** - Rate limiting
  - Global limit: 300 requests per 15 minutes
  - Prevents brute force attacks
  - Configurable per endpoint

### File Management

- **AWS SDK v3**
  - `@aws-sdk/client-s3` - S3 operations (upload, delete, list)
  - `@aws-sdk/lib-storage` - Multipart uploads for large files
  - `@aws-sdk/s3-request-presigner` - Generate pre-signed URLs
- **Multer v2.0.2** - File upload middleware
  - Handles multipart/form-data
  - File validation (size, type)
  - Memory storage before S3 upload

- **Sharp v0.34.5** - Image processing
  - Resize images for web optimization
  - Generate thumbnails
  - Convert formats (JPEG, WebP)
  - Compress images to reduce bandwidth
  ```typescript
  // Image processing example
  const optimized = await sharp(buffer)
    .resize(1200, 800, { fit: 'inside' })
    .jpeg({ quality: 85 })
    .toBuffer();
  ```

### Email Services

- **Resend v6.6.0** - Email delivery service
  - Send verification emails
  - Password reset emails
  - Lead notifications to sales team
  - Transactional emails with templates

### Data Processing

- **PapaParse v5.5.3** - CSV parsing
  - Import tour data from CSV files
  - Parse POI data
  - Batch data import scripts

- **Puppeteer v24.31.0** - Web scraping (headless Chrome)
  - Scrape monument data from government websites
  - Generate PDFs from HTML
  - Automated testing

### Validation

- **Zod v4.1.13** - Schema validation
  - Runtime type checking
  - Input validation for API endpoints
  - Type inference for TypeScript
  ```typescript
  // Validation example
  const registerSchema = z.object({
    name: z.string().min(2).max(255),
    email: z.string().email(),
    password: z.string().min(8),
  });
  ```

### AWS Services Integration

#### Amazon S3 (Simple Storage Service)

- **Bucket**: `way-india-tours`, `way-india-reviews`, `way-india-poi`
- **Purpose**: Store images, documents, and media files
- **Region**: ap-south-1 (Mumbai)
- **Access**: Private with pre-signed URLs for controlled access
- **Configuration**:
  ```typescript
  const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  ```

#### Amazon CloudFront (CDN)

- **Purpose**: Content delivery network for faster image loading
- **Distribution**: Global edge locations
- **Benefits**:
  - Reduced latency for users worldwide
  - Lower bandwidth costs
  - HTTPS support
- **URL Pattern**: `https://d[random].cloudfront.net/path/to/image.jpg`

#### IAM Roles & Permissions Required

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::way-india-*", "arn:aws:s3:::way-india-*/*"]
    }
  ]
}
```

---

## Project Setup Guide

### Prerequisites

Before setting up the project, ensure you have:

1. **Bun** (v1.2.2 or higher)

   ```bash
   # Windows (PowerShell)
   powershell -c "irm bun.sh/install.ps1 | iex"

   # Verify installation
   bun --version
   ```

2. **PostgreSQL Database**
   - Local installation OR
   - Cloud database (Supabase recommended)
   - Database URL and direct connection URL

3. **Redis Server**

   ```bash
   # Windows: Download from https://github.com/microsoftarchive/redis/releases
   # Or use Docker
   docker run -d -p 6379:6379 redis:latest
   ```

4. **AWS Account** (for S3 storage)
   - Access Key ID
   - Secret Access Key
   - S3 bucket created

5. **Git** (for version control)

### Installation Steps

#### 1. Clone the Repository

```bash
git clone <repository-url>
cd way-india-backend-main
```

#### 2. Install Dependencies

```bash
bun install
```

This will install all packages from `package.json`:

- express, prisma, bcrypt, jsonwebtoken, etc.

#### 3. Environment Variables Setup

Create a `.env` file in the project root:

```env
# Database Configuration
DATABASE_URL="postgresql://user:password@host:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://user:password@host:5432/postgres"

# Server Configuration
PORT=5000
NODE_ENV=development
MAINTENANCE_MODE=false

# JWT Secrets (generate random strings)
JWT_ACCESS_SECRET=your-access-token-secret-here-min-32-chars
JWT_REFRESH_SECRET=your-refresh-token-secret-here-min-32-chars
ACCESS_TOKEN_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=7d

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# AWS Configuration
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET_TOURS=way-india-tours
AWS_S3_BUCKET_REVIEWS=way-india-reviews
AWS_CLOUDFRONT_URL=https://d1234567890.cloudfront.net

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Email Service (Resend)
RESEND_API_KEY=re_your_resend_api_key
FROM_EMAIL=noreply@waytoindia.com

# Zoho CRM Integration (optional)
ZOHO_CLIENT_ID=your-zoho-client-id
ZOHO_CLIENT_SECRET=your-zoho-client-secret
ZOHO_REDIRECT_URI=http://localhost:5000/api/admin/zoho/callback
ZOHO_REFRESH_TOKEN=
```

**Generate JWT Secrets:**

```bash
# Generate random secrets
bun -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### 4. Database Setup

**Run Prisma Migrations:**

```bash
# Generate Prisma Client
bunx prisma generate

# Run migrations to create database tables
bunx prisma migrate deploy

# Or for development (creates migration files)
bunx prisma migrate dev --name init
```

**Seed Database with Initial Data:**

```bash
# Seed admin users and roles
bun run prisma/seed-admin.ts

# Seed sample data (optional)
bun run prisma/seed.ts
```

**View Database (Prisma Studio):**

```bash
bunx prisma studio
# Opens http://localhost:5555 with database GUI
```

#### 5. Run the Application

**Development Mode:**

```bash
bun run index.ts
```

**Production Mode:**

```bash
# Build TypeScript
bun build index.ts --outdir ./dist

# Run production build
bun run dist/index.js
```

**Server should start on:**

```
Server running on port 5000
http://localhost:5000
```

**Test API:**

```bash
curl http://localhost:5000/
# Should return: {"statusCode":200,"success":true,"data":{},"message":"API WORKING"}
```

### Common Troubleshooting

#### Issue: Database Connection Failed

**Solution:**

- Verify DATABASE_URL is correct
- Check if database server is running
- Ensure firewall allows connection
- For Supabase: Use connection pooling URL (port 6543)

#### Issue: Redis Connection Error

**Solution:**

```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# If not running, start Redis service
```

#### Issue: AWS S3 Upload Fails

**Solution:**

- Verify AWS credentials in `.env`
- Check IAM permissions for S3 access
- Ensure bucket exists and region is correct
- Test credentials:
  ```bash
  aws s3 ls s3://way-india-tours --region ap-south-1
  ```

#### Issue: Port Already in Use

**Solution:**

```bash
# Find process using port 5000
netstat -ano | findstr :5000

# Kill the process (replace PID)
taskkill /PID <PID> /F

# Or change PORT in .env file
```

#### Issue: Prisma Client Not Generated

**Solution:**

```bash
bunx prisma generate
```

---

## Application Architecture

### Folder Structure Explained

```
way-india-backend-main/
│
├── index.ts                      # Main server entry point
├── package.json                  # Project dependencies
├── tsconfig.json                 # TypeScript configuration
├── .env                          # Environment variables (not in git)
├── .env.example                  # Example env file
│
├── prisma/                       # Database related files
│   ├── schema.prisma             # Database schema definition
│   ├── migrations/               # Migration history
│   ├── generated/                # Auto-generated Prisma Client
│   ├── seed.ts                   # Database seeding script
│   └── seed-admin.ts             # Admin user seeding
│
├── src/                          # Source code
│   │
│   ├── routes/                   # API route definitions
│   │   ├── index.ts              # Main router setup
│   │   ├── user/                 # User-facing routes
│   │   │   ├── index.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── tour.routes.ts
│   │   │   └── review.routes.ts
│   │   ├── admin/                # Admin panel routes
│   │   │   ├── index.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── tour.routes.ts
│   │   │   ├── dashboard.routes.ts
│   │   │   ├── role.routes.ts
│   │   │   └── ...
│   │   └── common/               # Public routes
│   │       ├── index.ts
│   │       ├── tour.routes.ts
│   │       ├── query.routes.ts
│   │       └── ...
│   │
│   ├── controllers/              # Request handlers (business logic)
│   │   ├── user/
│   │   ├── admin/
│   │   └── common/
│   │
│   ├── services/                 # Database operations & external APIs
│   │   ├── user/
│   │   ├── admin/
│   │   └── common/
│   │
│   ├── middlewares/              # Middleware functions
│   │   ├── error.ts              # Global error handler
│   │   ├── handlers/
│   │   │   ├── responseHandler.ts  # Custom res.deliver()
│   │   │   └── errorHandler.ts     # Custom error classes
│   │   ├── user/
│   │   │   └── auth.middleware.ts  # User JWT verification
│   │   ├── admin/
│   │   │   └── auth.middleware.ts  # Admin JWT verification
│   │   ├── permission.middleware.ts # RBAC permission check
│   │   └── multer.ts             # File upload configuration
│   │
│   ├── utils/                    # Utility functions
│   │   ├── jwt.util.ts           # JWT token operations
│   │   ├── s3.util.ts            # AWS S3 operations
│   │   ├── email.util.ts         # Email sending
│   │   └── mediaPatch.ts         # CloudFront URL patching
│   │
│   ├── validators/               # Input validation schemas
│   │   ├── auth.validator.ts
│   │   ├── tour.validator.ts
│   │   └── ...
│   │
│   ├── config/                   # Configuration files
│   │   ├── db.ts                 # Prisma client instance
│   │   └── redis.ts              # Redis client setup
│   │
│   ├── types/                    # TypeScript type definitions
│   ├── constants/                # Application constants
│   ├── common/                   # Shared utilities
│   │   └── appRoutes.ts          # Route constants
│   │
│   └── scripts/                  # Utility scripts
│       ├── backup-database.ts
│       ├── import-poi-data.ts
│       └── ...
│
├── backups/                      # Database backups
└── scripts/                      # Shell scripts (PowerShell)
```

### Architecture Pattern: Layered Architecture

The application follows a **layered architecture** with clear separation:

```
┌─────────────────────────────────────────┐
│         Client (Frontend/API)           │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│     Routes Layer (Express Routing)      │
│  Defines endpoints & HTTP methods       │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│   Middleware Layer (Auth, Validation)   │
│  Authentication, RBAC, Rate Limiting    │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│    Controllers Layer (Request Logic)    │
│  Handles requests, calls services       │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Services Layer (Business Logic & DB)   │
│  Database queries, external API calls   │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         Data Layer (Database)           │
│    PostgreSQL, Redis, AWS S3            │
└─────────────────────────────────────────┘
```

### Request Flow Example

Let's trace a complete request: **"User creates a tour review"**

```typescript
// 1. CLIENT REQUEST
POST /api/user/reviews/
Authorization: Bearer eyJhbGc...
Body: { tourId, rating, title, comment }

// 2. ROUTES (src/routes/user/review.routes.ts)
router.post('/',
  authenticate,              // Middleware 1: Verify JWT
  uploadReviewImages,        // Middleware 2: Handle file upload
  ReviewController.createReview  // Controller
);

// 3. MIDDLEWARE (src/middlewares/user/auth.middleware.ts)
export const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  const decoded = JwtUtil.verifyUserAccessToken(token);
  req.user = decoded;  // Attach user to request
  next();
};

// 4. CONTROLLER (src/controllers/user/review.controller.ts)
export class ReviewController {
  static async createReview(req, res) {
    try {
      const userId = req.user.userId;
      const { tourId, rating, title, comment } = req.body;
      const images = req.files;

      // Call service
      const review = await ReviewService.createReview({
        userId, tourId, rating, title, comment, images
      });

      res.deliver(201, true, { review }, "Review created");
    } catch (error) {
      res.deliver(400, false, undefined, error.message);
    }
  }
}

// 5. SERVICE (src/services/user/review.service.ts)
export class ReviewService {
  static async createReview(data) {
    // Upload images to S3
    const imageUrls = await uploadImagesToS3(data.images);

    // Create review in database
    const review = await prisma.tourReview.create({
      data: {
        userId: data.userId,
        tourId: data.tourId,
        rating: data.rating,
        title: data.title,
        comment: data.comment,
        images: imageUrls
      }
    });

    // Update tour rating
    await updateTourRating(data.tourId);

    return review;
  }
}

// 6. RESPONSE
{
  "statusCode": 201,
  "success": true,
  "data": { "review": { ... } },
  "message": "Review created"
}
```

### Middleware Chain Execution Order

When a request comes in, middleware executes in this order:

1. **Express Built-in Middleware**
   - `express.json()` - Parse JSON bodies
   - `express.urlencoded()` - Parse URL-encoded bodies

2. **Global Middleware** (Applied to all routes)
   - Rate Limiting - Check request count
   - CORS - Allow cross-origin requests
   - Response Handler - Attach `res.deliver()` method
   - Maintenance Mode Check

3. **Route-Specific Middleware**
   - Authentication (`authMiddleware` / `authenticate`)
   - Permission Check (`checkPermission`)
   - File Upload (`uploadTourImages`, etc.)
   - Validation (Zod schemas)

4. **Controller Execution**
   - Business logic
   - Call services
   - Return response

5. **Error Handling** (if error occurs)
   - Global error handler catches all errors
   - Formats error response
   - Logs error details

### Custom Response Handler

All responses use a custom `res.deliver()` method:

```typescript
// src/middlewares/handlers/responseHandler.ts
const ResponseHandler = (req, res, next) => {
  res.deliver = (statusCode, success, data, message) => {
    return res.status(statusCode).json({
      statusCode,
      success,
      data: data || undefined,
      message: message || (success ? 'Success' : 'Failed'),
    });
  };
  next();
};
```

**Why custom response?**

- Consistency across all endpoints
- Easier to parse on frontend
- Standardized error/success format
- Reduces code duplication

### Error Handling Strategy

**Custom Error Classes:**

```typescript
// src/middlewares/handlers/errorHandler.ts
export class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.statusCode = 401;
  }
}

// Usage in controller
if (!user) {
  throw new UnauthorizedError('Invalid credentials');
}
```

**Global Error Handler:**

```typescript
// src/middlewares/error.ts
module.exports = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Log error (in production, send to logging service)
  console.error(err);

  res.deliver(statusCode, false, undefined, message);
};
```

---

## 🚧 Leads Section - IN PROGRESS

> [!CAUTION]
> **ACTIVE DEVELOPMENT IN PROGRESS**  
> This feature is currently under active development. The system architecture and APIs are subject to change. Please check with the development team for the latest updates before implementing features dependent on this section.
>
> **Last Updated:** January 6, 2026  
> **Status:** Alpha - Internal Testing Only  
> **Expected Stable Release:** Q1 2026

### Current Lead Management System

The leads system captures and manages customer inquiries from various sources:

#### Lead Sources

1. **Tour Queries** - Customers interested in tour packages
2. **Hotel Queries** - Hotel booking requests
3. **Transport Queries** - Transportation service requests
4. **Contact Us** - General inquiries

#### Lead Workflow

```mermaid
stateDiagram-v2
    [*] --> NEW: Query Submitted
    NEW --> CONTACTED: Admin reaches out
    CONTACTED --> QUALIFIED: Customer interested
    CONTACTED --> REJECTED: Not interested
    QUALIFIED --> CONVERTED: Booking confirmed
    QUALIFIED --> FOLLOW_UP: Needs follow-up
    FOLLOW_UP --> QUALIFIED: Re-engaged
    FOLLOW_UP --> REJECTED: No response
    CONVERTED --> [*]
    REJECTED --> [*]
```

#### Lead Assignment

- Leads can be assigned to specific admins
- Unassigned leads visible to all admins
- Assignment tracked in activity log

#### Activity Tracking

Every action on a lead is logged:

- Status changes
- Notes added
- Emails sent
- Calls made
- Assignment changes

**Example Activity Log:**

```json
[
  {
    "activityType": "LEAD_CREATED",
    "description": "Lead created from tour query",
    "performedBy": "SYSTEM",
    "createdAt": "2026-01-06T10:00:00Z"
  },
  {
    "activityType": "STATUS_CHANGE",
    "description": "Status changed from NEW to CONTACTED",
    "performedBy": "Admin Name",
    "createdAt": "2026-01-06T11:30:00Z"
  },
  {
    "activityType": "NOTE_ADDED",
    "description": "Customer interested in 7-day Rajasthan tour",
    "performedBy": "Admin Name",
    "createdAt": "2026-01-06T12:00:00Z"
  }
]
```

### Zoho CRM Integration

> [!WARNING]
> **Zoho Integration Status: Experimental**  
> The Zoho CRM integration is currently in testing phase and may not sync reliably. Manual verification recommended.

**Current Implementation:**

- OAuth 2.0 authentication with Zoho
- One-way sync: Backend → Zoho
- Syncs lead data on creation
- Updates reference number in Zoho

**Zoho API Callback:**

```
GET /api/admin/zoho/callback?code=...
```

After authorization, refresh token is stored for future API calls.

**Known Issues:**

- ⚠️ Sync failures not automatically retried
- ⚠️ No bi-directional sync (Zoho → Backend)
- ⚠️ Lead updates don't re-sync to Zoho
- ⚠️ Token refresh logic needs improvement

### Planned Features (Coming Soon)

1. **Lead Scoring System**
   - Automatic lead prioritization
   - Based on budget, response time, engagement

2. **Email Templates**
   - Pre-defined templates for common responses
   - Automated follow-up emails

3. **Lead Analytics Dashboard**
   - Conversion rates by source
   - Response time metrics
   - Admin performance tracking

4. **WhatsApp Integration**
   - Send messages directly from admin panel
   - Track conversation history

5. **Automated Lead Assignment**
   - Round-robin distribution
   - Based on admin workload

### Migration Plan

The team is planning to replace Zoho with an in-house CRM system by Q2 2026. This will provide:

- Better integration with backend
- Custom workflows specific to our business
- No third-party dependency
- Cost savings

---

## Authentication & Authorization

### User Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant DB as Database
    participant E as Email Service

    U->>F: Enter email/password
    F->>B: POST /api/user/auth/register
    B->>DB: Check if email exists
    DB-->>B: Email available
    B->>B: Hash password with bcrypt
    B->>DB: Create user (isEmailVerified: false)
    DB-->>B: User created
    B->>E: Send verification email
    B-->>F: {success: true, user}
    F-->>U: "Check your email"

    U->>U: Click verification link in email
    U->>B: GET /api/user/auth/verify-email?token=xyz
    B->>B: Verify token
    B->>DB: Update user (isEmailVerified: true)
    B->>B: Generate access + refresh tokens
    B-->>F: {tokens, user}
    F-->>U: Logged in automatically
```

**Token Structure:**

```typescript
// Access Token Payload
{
  "userId": "uuid-here",
  "email": "user@example.com",
  "isEmailVerified": true,
  "iat": 1704537600,      // Issued at
  "exp": 1704541200       // Expires at (1 hour)
}

// Refresh Token Payload
{
  "userId": "uuid-here",
  "email": "user@example.com",
  "type": "refresh",
  "iat": 1704537600,
  "exp": 1705142400       // Expires at (7 days)
}
```

### Token Refresh Mechanism

When access token expires, frontend requests a new one:

```http
POST /api/user/auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}
```

**Backend Process:**

1. Verify refresh token signature
2. Check if token is expired
3. Find user in database
4. Generate new access token
5. Optionally rotate refresh token
6. Return new tokens

### Admin Authentication Flow

Similar to user auth but with additional role/permission loading:

```typescript
// Admin Login
1. Verify email/password
2. Fetch admin with role
3. Load all permissions for role
4. Generate tokens with roleId in payload
5. Update lastLoginAt timestamp
6. Return admin + permissions + tokens
```

**Admin Token Payload:**

```typescript
{
  "adminId": "uuid-here",
  "email": "admin@waytoindia.com",
  "roleId": "role-id",
  "iat": 1704537600,
  "exp": 1704541200
}
```

### RBAC (Role-Based Access Control) Explanation

**How it works:**

1. **Admin has ONE Role** (e.g., "Content Manager")
2. **Role has MANY Permissions** (one per module)
3. **Permission has 4 flags**: view, create, edit, delete

**Example Scenario:**

```typescript
// Role: Content Manager
{
  "name": "Content Manager",
  "permissions": [
    {
      "module": "Tours",
      "view": true,
      "create": true,
      "edit": true,
      "delete": false      // Cannot delete tours
    },
    {
      "module": "Leads",
      "view": true,
      "create": false,
      "edit": false,
      "delete": false      // Read-only access to leads
    }
  ]
}
```

**Permission Check Middleware:**

```typescript
// src/middlewares/permission.middleware.ts
export const checkPermission = (moduleName, action) => {
  return async (req, res, next) => {
    const admin = req.admin;

    // Fetch admin's role with permissions
    const role = await prisma.role.findUnique({
      where: { id: admin.roleId },
      include: {
        permissions: {
          include: { module: true },
        },
      },
    });

    // Find permission for this module
    const permission = role.permissions.find((p) => p.module.name === moduleName);

    if (!permission || !permission[action]) {
      return res.deliver(
        403,
        false,
        undefined,
        "You don't have permission to " + action + ' ' + moduleName
      );
    }

    next();
  };
};

// Usage in routes
router.post(
  '/create',
  authMiddleware,
  checkPermission('Tours', 'create'),
  TourController.createTour
);
```

---

## Security Measures

### 1. Rate Limiting

Protects against brute force and DDoS attacks:

```typescript
// index.ts
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Max 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later',
});

app.use(globalLimiter);
```

**Endpoint-Specific Limits:**

- Login endpoints: 5 attempts per 15 minutes
- Registration: 3 attempts per hour per IP

### 2. CORS Policy

```typescript
app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
```

**Production:** Restrict origin to specific domain

### 3. Password Security

- **Hashing:** bcrypt with 10 salt rounds
- **Storage:** Never store plain text passwords
- **Validation:** Minimum 8 characters required
- **Reset:** Time-limited reset tokens

```typescript
// Hashing password
const hashedPassword = await bcrypt.hash(password, 10);

// Comparing password
const isValid = await bcrypt.compare(password, hashedPassword);
```

### 4. JWT Security

- **Secret Keys:** Stored in environment variables
- **Expiry:** Short-lived access tokens (1 hour)
- **Refresh Rotation:** Refresh tokens rotated on use
- **Verification:** All protected routes verify token signature

### 5. SQL Injection Prevention

Prisma ORM provides automatic protection:

- Parameterized queries
- Type safety
- No raw SQL in business logic

```typescript
// Safe from SQL injection
const user = await prisma.user.findUnique({
  where: { email: userInput }, // Automatically escaped
});
```

### 6. File Upload Security

```typescript
// Multer configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Only allow images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'));
    }
  },
});
```

### 7. Environment Variables

- Never commit `.env` to git
- Use `.env.example` as template
- Rotate secrets regularly
- Use different secrets for dev/prod

### 8. HTTPS in Production

- All API calls must use HTTPS
- Certificates from Let's Encrypt
- HTTP redirects to HTTPS

---

## Additional Information

### Redis Caching Strategy

```typescript
// Example: Cache tour details for 5 minutes
const getCachedTour = async (slug) => {
  const cached = await redis.get(`tour:${slug}`);
  if (cached) return JSON.parse(cached);

  const tour = await prisma.tour.findUnique({
    where: { slug },
  });

  await redis.setex(`tour:${slug}`, 300, JSON.stringify(tour));
  return tour;
};
```

**Cache Invalidation:**
When tour is updated, clear cache:

```typescript
await redis.del(`tour:${slug}`);
```

### Database Backup Scripts

Located in `scripts/` folder:

```bash
# Manual backup
bun run backup:db

# Restore backup
bun run backup:restore

# Schedule automatic backups (Windows)
bun run backup:setup
```

Backups stored in `backups/` directory with timestamp.

### Logging Strategy

Currently using `console.log()` for development.

**Production Recommendations:**

- Use Winston or Pino for structured logging
- Log rotation to prevent disk fill-up
- Send critical errors to external service (Sentry, LogRocket)

### Performance Optimization

1. **Database Indexes** - All query-heavy columns indexed
2. **Prisma Connection Pooling** - Reuses database connections
3. **Image Optimization** - Sharp compresses images
4. **CDN** - CloudFront reduces server load
5. **Redis Caching** - Reduces database queries

---

## Deployment Recommendations

### Environment Setup

1. **Production Server** (AWS EC2, DigitalOcean, etc.)
   - Ubuntu 22.04 LTS
   - Nginx as reverse proxy
   - PM2 for process management

2. **Install Bun:**

   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

3. **Install PM2:**

   ```bash
   npm install -g pm2
   ```

4. **Run with PM2:**
   ```bash
   pm2 start index.ts --name way-india-api
   pm2 save
   pm2 startup
   ```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name api.waytoindia.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### SSL Certificate (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.waytoindia.com
```

### Environment Variables in Production

Use `.env` file or set via hosting platform's dashboard.

**Never expose sensitive data in code or logs!**

---

## Contact & Support

For questions or issues with this backend system:

- **Developer Email:** developer@waytoindia.com
- **Documentation Issues:** Open issue in repository
- **Emergency Contact:** Check internal documentation

---

**End of Documentation**

_This documentation is maintained by the Way to India development team. Last reviewed: January 6, 2026_

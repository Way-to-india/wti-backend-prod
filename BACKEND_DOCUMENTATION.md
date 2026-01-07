    # Way to India - Backend Documentation

    > **Comprehensive Developer Guide**  
    > Last Updated: January 6, 2026

    ---

    ## Table of Contents

    1. [API Overview](#api-overview)
    2. [Database Schema](#database-schema)
    3. [User APIs](#user-apis)
    4. [Admin APIs](#admin-apis)
    5. [Common/Public APIs](#commonpublic-apis)
    6. [Technology Stack](#technology-stack)
    7. [Project Setup Guide](#project-setup-guide)
    8. [Application Architecture](#application-architecture)
    9. [🚧 Leads Section - IN PROGRESS](#-leads-section---in-progress)
    10. [Authentication & Authorization](#authentication--authorization)
    11. [Security Measures](#security-measures)

    ---

    ## API Overview

    ### Architecture Overview

    The Way to India backend follows a **layered architecture pattern** with clear separation of concerns:

    ```mermaid
    graph TD
        A[Client Request] --> B[Express Server]
        B --> C[Global Middleware Layer]
        C --> D{Route Type}
        D -->|/api/user| E[User Routes]
        D -->|/api/admin| F[Admin Routes]
        D -->|/api/common| G[Common Routes]
        E --> H[Controllers]
        F --> H
        G --> H
        H --> I[Services]
        I --> J[Prisma ORM]
        J --> K[(PostgreSQL Database)]
        I --> L[(Redis Cache)]
        I --> M[AWS S3]
        H --> N[Response Handler]
        N --> O[Client Response]
    ```

    ### Base URL Structure

    ```
    Production: https://api.waytoindia.com
    Development: http://localhost:5000

    ├── /api/user/*          # User-facing endpoints
    ├── /api/admin/*         # Admin panel endpoints (protected)
    └── /api/common/*        # Public endpoints (no authentication)
    ```

    ### Request-Response Flow

    1. **Request Reception**: Express receives incoming HTTP request
    2. **Global Middleware**:
    - Rate limiting (300 requests/15 minutes)
    - CORS handling
    - JSON body parsing (50MB limit)
    - Maintenance mode check
    3. **Response Handler**: Custom middleware attaches `res.deliver()` method
    4. **Authentication Check**: JWT token verification (if protected route)
    5. **Permission Check**: RBAC validation (admin routes only)
    6. **Controller Execution**: Business logic processing
    7. **Service Layer**: Database operations, external API calls
    8. **Response Delivery**: Standardized JSON response

    ### Standard Response Format

    All API responses follow this consistent structure:

    ```typescript
    // Success Response
    {
    "statusCode": 200,
    "success": true,
    "data": { /* response data */ },
    "message": "Operation successful"
    }

    // Error Response
    {
    "statusCode": 400,
    "success": false,
    "data": undefined,
    "message": "Error description"
    }
    ```

    ### HTTP Status Codes

    | Code  | Meaning               | Usage                                    |
    | ----- | --------------------- | ---------------------------------------- |
    | `200` | OK                    | Successful GET, PUT, PATCH, DELETE       |
    | `201` | Created               | Successful POST (resource created)       |
    | `400` | Bad Request           | Validation errors, invalid input         |
    | `401` | Unauthorized          | Missing or invalid authentication token  |
    | `403` | Forbidden             | Valid token but insufficient permissions |
    | `404` | Not Found             | Resource doesn't exist                   |
    | `429` | Too Many Requests     | Rate limit exceeded                      |
    | `500` | Internal Server Error | Server-side error                        |

    ---

    ## Database Schema

    The application uses **PostgreSQL** as the primary database with **Prisma ORM** for type-safe database access. Below is a detailed explanation of all database models.

    ### Entity Relationship Overview

    ```mermaid
    erDiagram
        USER ||--o{ TOUR_REVIEW : writes
        TOUR ||--o{ TOUR_REVIEW : has
        TOUR ||--o{ TOUR_CITY : includes
        TOUR ||--o{ TOUR_THEME : has
        TOUR ||--o{ TOUR_ITINERARY : contains
        TOUR ||--o{ TOUR_PRICE_GUIDE : has
        CITY ||--o{ TOUR_CITY : features_in
        THEME ||--o{ TOUR_THEME : categorizes
        ADMIN ||--o{ LEAD : manages
        ADMIN }o--|| ROLE : has
        ROLE ||--o{ PERMISSION : grants
        MODULE ||--o{ PERMISSION : controls
        LEAD ||--o{ LEAD_ACTIVITY : tracks
    ```

    ### Core Models

    #### 1. User Model

    Represents end-users who can browse tours and write reviews.

    ```prisma
    model User {
    id                String       @id @default(uuid())
    name              String       @db.VarChar(255)
    phone             String?      @unique @db.VarChar(20)
    email             String       @unique @db.VarChar(255)
    profileImage      String?      @db.VarChar(500)
    profileCoverImage String?      @db.VarChar(500)
    address           String?      @db.VarChar(500)
    pinCode           String?      @db.VarChar(10)
    bio               String?
    password          String       @db.VarChar(255)    // bcrypt hashed
    isActive          Boolean      @default(true)
    countryCode       Int          @default(91)
    isPhoneVerified   Boolean      @default(false)
    isEmailVerified   Boolean      @default(false)
    createdAt         DateTime     @default(now())
    updatedAt         DateTime     @updatedAt
    reviews           TourReview[]

    @@index([isActive, createdAt(sort: Desc)])
    @@index([email])
    @@index([phone])
    }
    ```

    **Key Points:**

    - Uses UUID for primary key for security
    - Email and phone are unique and indexed for fast lookups
    - Email verification required before full access
    - Password stored as bcrypt hash (never plain text)
    - Soft delete via `isActive` flag instead of hard deletion

    #### 2. Tour Model

    Central entity for tour packages.

    ```prisma
    model Tour {
    id                 String           @id @default(cuid())
    title              String           @db.VarChar(255)
    slug               String           @unique @db.VarChar(300)
    metatitle          String?          @db.VarChar(255)
    metadesc           String?          @db.VarChar(500)
    overview           String?          // Rich text
    description        String?          // Rich text
    durationDays       Int              @default(0)
    durationNights     Int              @default(0)
    price              Int              @default(0)       // In INR
    discountPrice      Int?
    currency           String           @default("INR")
    minGroupSize       Int              @default(1)
    maxGroupSize       Int              @default(50)
    bestTime           String?
    idealFor           String?
    difficulty         String?          // Easy, Moderate, Challenging
    rating             Decimal          @default(0) @db.Decimal(3, 2)
    reviewCount        Int              @default(0)
    viewCount          Int              @default(0)
    bookingCount       Int              @default(0)
    isActive           Boolean          @default(true)
    isFeatured         Boolean          @default(false)
    cancellationPolicy String?
    travelTips         String?
    startCityId        String?
    createdAt          DateTime         @default(now())
    updatedAt          DateTime         @updatedAt

    // Array fields
    images             String[]         // S3 URLs
    highlights         String[]
    inclusions         String[]
    exclusions         String[]

    // Relations
    faqs               Faq[]
    reviews            TourReview[]
    cities             TourCity[]
    itinerary          TourItinerary[]
    priceGuide         TourPriceGuide[]
    themes             TourTheme[]
    startCity          City?            @relation("TourStartCity", fields: [startCityId], references: [id])

    @@index([isActive, isFeatured, rating(sort: Desc)])
    @@index([isActive, price, rating(sort: Desc)])
    @@index([slug])
    }
    ```

    **Key Points:**

    - Uses CUID for sequential-like IDs while remaining hard to guess
    - Slug for SEO-friendly URLs
    - Multiple indexes for common query patterns (featured tours, price sorting, rating)
    - Array fields for flexible data storage (images, highlights, etc.)
    - Decimal type for precise rating calculations
    - Tracks engagement metrics (viewCount, bookingCount)

    #### 3. Admin & RBAC Models

    Complete Role-Based Access Control system.

    ```prisma
    // Admin users with role-based permissions
    model Admin {
    id                 String         @id @default(uuid())
    name               String         @db.VarChar(255)
    email              String         @unique @db.VarChar(255)
    password           String         @db.VarChar(255)
    roleId             String
    isActive           Boolean        @default(true)
    lastLoginAt        DateTime?
    refreshToken       String?        @db.VarChar(500)
    refreshTokenExpiry DateTime?
    createdAt          DateTime       @default(now())
    updatedAt          DateTime       @updatedAt
    role               Role           @relation(fields: [roleId], references: [id])
    leads              Lead[]
    leadActivities     LeadActivity[]

    @@index([email])
    @@index([isActive])
    @@index([roleId])
    }

    // Roles like Super Admin, Manager, Sales Rep
    model Role {
    id          String       @id @default(cuid())
    name        String       @unique @db.VarChar(100)
    description String?
    isActive    Boolean      @default(true)
    createdAt   DateTime     @default(now())
    updatedAt   DateTime     @updatedAt
    admins      Admin[]
    permissions Permission[]

    @@index([name])
    }

    // Modules like Tours, Leads, Admins, etc.
    model Module {
    id          String       @id @default(cuid())
    name        String       @unique @db.VarChar(100)
    label       String       @db.VarChar(150)      // Display name
    description String?
    icon        String?                             // UI icon
    order       Int          @default(0)
    isActive    Boolean      @default(true)
    createdAt   DateTime     @default(now())
    updatedAt   DateTime     @updatedAt
    permissions Permission[]

    @@index([name])
    @@index([isActive, order])
    }

    // Permission junction table with granular CRUD
    model Permission {
    id        String   @id @default(cuid())
    roleId    String
    moduleId  String
    view      Boolean  @default(false)
    create    Boolean  @default(false)
    edit      Boolean  @default(false)
    delete    Boolean  @default(false)
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
    role      Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
    module    Module   @relation(fields: [moduleId], references: [id], onDelete: Cascade)

    @@unique([roleId, moduleId])
    @@index([roleId])
    @@index([moduleId])
    }
    ```

    **RBAC System Explained:**

    1. **Admins** are assigned a single **Role**
    2. Each **Role** has multiple **Permissions**
    3. **Permissions** define CRUD access to **Modules**
    4. Example: "Sales Manager" role might have:
    - Leads module: view ✓, create ✓, edit ✓, delete ✗
    - Tours module: view ✓, create ✗, edit ✗, delete ✗

    #### 4. Lead Management Models

    ```prisma
    enum LeadStatus {
    NEW
    CONTACTED
    QUALIFIED
    CONVERTED
    REJECTED
    FOLLOW_UP
    }

    enum LeadSource {
    TOUR_QUERY
    HOTEL_QUERY
    TRANSPORT_QUERY
    CONTACT_US
    }

    model Lead {
    id              String         @id @default(cuid())
    referenceNumber String         @unique        // e.g., "LEAD-2026-0001"
    source          LeadSource
    status          LeadStatus     @default(NEW)
    fullName        String
    email           String
    phoneNumber     String?
    details         Json                          // Flexible JSON for different query types
    assignedToId    String?
    assignedTo      Admin?         @relation(fields: [assignedToId], references: [id])
    priority        Int            @default(0)    // 0=Low, 1=Medium, 2=High
    notes           String?
    zohoLeadId      String?                       // Zoho CRM integration
    syncedToZoho    Boolean        @default(false)
    lastSyncedAt    DateTime?
    ipAddress       String?
    userAgent       String?
    createdAt       DateTime       @default(now())
    updatedAt       DateTime       @updatedAt
    contactedAt     DateTime?
    activities      LeadActivity[]

    @@index([source, status, createdAt(sort: Desc)])
    @@index([referenceNumber])
    }

    model LeadActivity {
    id            String   @id @default(cuid())
    leadId        String
    activityType  String              // STATUS_CHANGE, NOTE_ADDED, EMAIL_SENT, etc.
    description   String
    performedById String?
    performedBy   Admin?   @relation(fields: [performedById], references: [id])
    createdAt     DateTime @default(now())
    lead          Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)

    @@index([leadId, createdAt(sort: Desc)])
    }
    ```

    **Key Points:**

    - Automatic reference number generation for tracking
    - JSON `details` field allows different structures for different query types
    - Activity log tracks all changes and actions on leads
    - Zoho CRM integration fields for syncing

    #### 5. Travel Guide Models

    ```prisma
    model TravelGuideState {
    id        String            @id @default(cuid())
    name      String
    slug      String?           @unique
    createdAt DateTime          @default(now())
    updatedAt DateTime          @updatedAt
    cities    TravelGuideCity[]
    data      TravelGuideData[]

    @@index([slug])
    }

    model TravelGuideCity {
    id        String            @id @default(cuid())
    name      String
    slug      String?           @unique
    stateId   String
    stateName String
    createdAt DateTime          @default(now())
    updatedAt DateTime          @updatedAt
    state     TravelGuideState  @relation(fields: [stateId], references: [id], onDelete: Cascade)
    data      TravelGuideData[]

    @@index([stateId])
    @@index([slug])
    }

    model TravelGuideData {
    id                String           @id @default(cuid())
    cityId            String
    citySlug          String?
    stateId           String
    stateSlug         String?
    isActive          Boolean          @default(true)
    introduction      String?          @db.Text
    facts             String?          @db.Text
    foodAndDining     String?          @db.Text
    shopping          String?          @db.Text
    nearbyPlaces      String?          @db.Text
    gettingAround     String?          @db.Text
    historyCulture    String?          @db.Text
    otherDetails      String?          @db.Text
    bestTimeToVisit   String?
    placesToSeeTop    String?          @db.Text
    placesToSeeBottom String?          @db.Text
    hotelDetails      String?          @db.Text
    cityImage         String?
    createdAt         DateTime         @default(now())
    updatedAt         DateTime         @updatedAt
    city              TravelGuideCity  @relation(fields: [cityId], references: [id])
    state             TravelGuideState @relation(fields: [stateId], references: [id])

    @@unique([cityId, stateId])
    @@index([citySlug])
    @@index([isActive])
    }
    ```

    ### Database Relationships Summary

    | Relationship      | Type         | Description                          |
    | ----------------- | ------------ | ------------------------------------ |
    | User → TourReview | One-to-Many  | One user can write multiple reviews  |
    | Tour → TourReview | One-to-Many  | One tour can have multiple reviews   |
    | Tour → TourCity   | Many-to-Many | Tours can cover multiple cities      |
    | Tour → TourTheme  | Many-to-Many | Tours can have multiple themes       |
    | Admin → Role      | Many-to-One  | Each admin has one role              |
    | Role → Permission | One-to-Many  | Role defines permissions for modules |
    | Lead → Admin      | Many-to-One  | Leads assigned to admins             |

    ---

    ## User APIs

    Base path: `/api/user`

    ### Authentication Endpoints

    #### 1. User Registration

    ```http
    POST /api/user/auth/register
    Content-Type: application/json

    {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123!",
    "phone": "9876543210",
    "countryCode": 91
    }
    ```

    **Response (201 Created):**

    ```json
    {
    "statusCode": 201,
    "success": true,
    "data": {
        "user": {
        "id": "uuid-here",
        "name": "John Doe",
        "email": "john@example.com",
        "isEmailVerified": false
        }
    },
    "message": "Registration successful. Please verify your email."
    }
    ```

    **Business Logic:**

    1. Validates email format and password strength (Zod validation)
    2. Checks if email already exists (unique constraint)
    3. Hashes password using bcrypt (10 rounds)
    4. Creates user record with `isEmailVerified: false`
    5. Sends verification email via Resend service
    6. Returns user data (password excluded)

    #### 2. User Login

    ```http
    POST /api/user/auth/login
    Content-Type: application/json

    {
    "email": "john@example.com",
    "password": "SecurePass123!"
    }
    ```

    **Response (200 OK):**

    ```json
    {
    "statusCode": 200,
    "success": true,
    "data": {
        "user": {
        "id": "uuid-here",
        "name": "John Doe",
        "email": "john@example.com",
        "isEmailVerified": true,
        "profileImage": "https://cdn.waytoindia.com/users/profile.jpg"
        },
        "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    },
    "message": "Login successful"
    }
    ```

    **Business Logic:**

    1. Find user by email
    2. Compare password with bcrypt hash
    3. Check if user is active (`isActive: true`)
    4. Generate JWT access token (expires in 1 hour)
    5. Generate JWT refresh token (expires in 7 days)
    6. Return tokens and user data

    #### 3. Email Verification

    ```http
    GET /api/user/auth/verify-email?token=verification-token-here
    ```

    **Response (200 OK):**

    ```json
    {
    "statusCode": 200,
    "success": true,
    "data": {
        "user": {
        /* user object */
        },
        "accessToken": "...",
        "refreshToken": "..."
    },
    "message": "Email verified successfully. You are now logged in."
    }
    ```

    **Business Logic:**

    1. Decode verification token
    2. Find user and update `isEmailVerified: true`
    3. Auto-login: generate access and refresh tokens
    4. Return user data with tokens

    #### 4. Get User Profile

    ```http
    GET /api/user/auth/me
    Authorization: Bearer <access-token>
    ```

    **Response (200 OK):**

    ```json
    {
    "statusCode": 200,
    "success": true,
    "data": {
        "id": "uuid-here",
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "9876543210",
        "profileImage": "https://...",
        "isEmailVerified": true,
        "createdAt": "2026-01-01T00:00:00Z"
    },
    "message": "Profile fetched successfully"
    }
    ```

    **Authentication:** Required (JWT Bearer token)

    ### Review Endpoints

    #### 1. Create Tour Review

    ```http
    POST /api/user/reviews/
    Authorization: Bearer <access-token>
    Content-Type: multipart/form-data

    {
    "tourId": "tour-cuid",
    "rating": 5,
    "title": "Amazing experience!",
    "comment": "The tour was absolutely wonderful...",
    "images": [File, File]  // Optional review images
    }
    ```

    **Response (201 Created):**

    ```json
    {
    "statusCode": 201,
    "success": true,
    "data": {
        "review": {
        "id": "review-cuid",
        "tourId": "tour-cuid",
        "userId": "user-uuid",
        "rating": 5,
        "title": "Amazing experience!",
        "comment": "The tour was absolutely wonderful...",
        "isVerified": false,
        "images": [
            {
            "url": "https://cdn.waytoindia.com/reviews/img1.jpg",
            "thumbnail": "https://cdn.waytoindia.com/reviews/img1_thumb.jpg"
            }
        ],
        "createdAt": "2026-01-06T12:00:00Z"
        }
    },
    "message": "Review submitted successfully"
    }
    ```

    **Business Logic:**

    1. Verify user is authenticated
    2. Check user hasn't already reviewed this tour (unique constraint)
    3. Upload images to S3 if provided
    4. Generate thumbnails using Sharp
    5. Create review with `isVerified: false` (admin approval needed)
    6. Update tour's `reviewCount` and `rating` (calculated average)

    #### 2. List Reviews

    ```http
    GET /api/user/reviews?tourId=tour-cuid&page=1&limit=10&sortBy=createdAt&order=desc
    ```

    **Response:** Paginated list of reviews for a tour

    ### Tour Browsing Endpoints

    #### Get User Tour Details

    ```http
    GET /api/user/tour/{slug}
    ```

    **Response (200 OK):**

    ```json
    {
    "statusCode": 200,
    "success": true,
    "data": {
        "tour": {
        "id": "tour-cuid",
        "title": "Magical Rajasthan Tour",
        "slug": "magical-rajasthan-tour",
        "description": "...",
        "durationDays": 7,
        "durationNights": 6,
        "price": 45000,
        "discountPrice": 39000,
        "rating": 4.8,
        "reviewCount": 124,
        "images": ["url1", "url2"],
        "highlights": ["Visit Jaipur", "Explore Udaipur"],
        "inclusions": ["Hotel", "Meals"],
        "exclusions": ["Flights"],
        "itinerary": [
            {
            "day": 1,
            "title": "Arrival in Jaipur",
            "description": "...",
            "imageUrl": "..."
            }
        ],
        "cities": [{ "name": "Jaipur", "slug": "jaipur" }],
        "themes": [{ "name": "Heritage", "slug": "heritage" }],
        "reviews": [
            /* latest reviews */
        ]
        }
    },
    "message": "Tour fetched successfully"
    }
    ```

    ---

    ## Admin APIs

    Base path: `/api/admin`

    **Global Middleware:** All admin routes require:

    1. JWT authentication (`authMiddleware`)
    2. RBAC permission check (`checkPermission`)

    ### Authentication

    #### Admin Login

    ```http
    POST /api/admin/auth/login
    Content-Type: application/json

    {
    "email": "admin@waytoindia.com",
    "password": "AdminPass123!"
    }
    ```

    **Response (200 OK):**

    ```json
    {
    "statusCode": 200,
    "success": true,
    "data": {
        "admin": {
        "id": "admin-uuid",
        "name": "Admin Name",
        "email": "admin@waytoindia.com",
        "role": {
            "id": "role-id",
            "name": "Super Admin",
            "permissions": [
            {
                "module": "Tours",
                "view": true,
                "create": true,
                "edit": true,
                "delete": true
            }
            ]
        }
        },
        "accessToken": "eyJhbGc...",
        "refreshToken": "eyJhbGc..."
    },
    "message": "Login successful"
    }
    ```

    **Token Payload Structure:**

    ```typescript
    {
    "adminId": "uuid",
    "email": "admin@waytoindia.com",
    "roleId": "role-id",
    "iat": 1234567890,
    "exp": 1234571490  // 1 hour expiry
    }
    ```

    ### Dashboard

    #### Get Analytics

    ```http
    GET /api/admin/dashboard/
    Authorization: Bearer <admin-access-token>
    ```

    **Response:**

    ```json
    {
    "statusCode": 200,
    "success": true,
    "data": {
        "overview": {
        "totalTours": 150,
        "activeTours": 142,
        "totalReviews": 1240,
        "totalLeads": 456,
        "newLeadsToday": 12
        },
        "leadsByStatus": {
        "NEW": 45,
        "CONTACTED": 120,
        "QUALIFIED": 80,
        "CONVERTED": 150,
        "REJECTED": 61
        },
        "recentLeads": [
        /* last 10 leads */
        ],
        "topTours": [
        /* tours by booking count */
        ]
    },
    "message": "Dashboard data fetched"
    }
    ```

    ### Tour Management

    #### Create Tour

    ```http
    POST /api/admin/tours/create
    Authorization: Bearer <admin-access-token>
    Content-Type: multipart/form-data
    X-Required-Permission: Tours.create

    {
    "title": "Golden Triangle Tour",
    "slug": "golden-triangle-tour",
    "description": "...",
    "durationDays": 5,
    "durationNights": 4,
    "price": 35000,
    "highlights": ["Taj Mahal", "Amber Fort"],
    "cityIds": ["city-id-1", "city-id-2"],
    "themeIds": ["theme-id-1"],
    "images": [File, File, File],
    "itinerary": [
        {
        "day": 1,
        "title": "Delhi Arrival",
        "description": "...",
        "image": File
        }
    ]
    }
    ```

    **Business Logic:**

    1. Verify admin has "create" permission for "Tours" module
    2. Validate input data (Zod schemas)
    3. Upload images to S3 bucket `way-india-tours/`
    4. Process image optimization using Sharp (resize, compress)
    5. Create tour record with generated CloudFront URLs
    6. Create related records (TourCity, TourTheme, TourItinerary)
    7. Return complete tour object

    #### List All Tours (Admin)

    ```http
    GET /api/admin/tours?page=1&limit=20&search=rajasthan&sortBy=createdAt&order=desc&isActive=true
    Authorization: Bearer <admin-access-token>
    X-Required-Permission: Tours.view
    ```

    **Query Parameters:**

    - `page`: Page number (default: 1)
    - `limit`: Items per page (default: 20)
    - `search`: Search in title, description
    - `sortBy`: rating | price | createdAt | bookingCount
    - `order`: asc | desc
    - `isActive`: true | false | undefined (all)
    - `isFeatured`: true | false

    **Response:**

    ```json
    {
    "statusCode": 200,
    "success": true,
    "data": {
        "tours": [
        /* array of tour objects */
        ],
        "pagination": {
        "total": 150,
        "page": 1,
        "limit": 20,
        "totalPages": 8
        }
    },
    "message": "Tours fetched successfully"
    }
    ```

    ### Role & Permission Management

    #### Create Role

    ```http
    POST /api/admin/role/create
    Authorization: Bearer <admin-access-token>
    X-Required-Permission: Roles.create

    {
    "name": "Content Manager",
    "description": "Manages tours and travel guides",
    "permissions": [
        {
        "moduleId": "tours-module-id",
        "view": true,
        "create": true,
        "edit": true,
        "delete": false
        },
        {
        "moduleId": "travel-guide-module-id",
        "view": true,
        "create": true,
        "edit": true,
        "delete": true
        }
    ]
    }
    ```

    **Response:**

    ```json
    {
    "statusCode": 201,
    "success": true,
    "data": {
        "role": {
        "id": "role-cuid",
        "name": "Content Manager",
        "description": "Manages tours and travel guides",
        "permissions": [
            /* full permission objects */
        ]
        }
    },
    "message": "Role created successfully"
    }
    ```

    ---

    ## Common/Public APIs

    Base path: `/api/common`

    **Note:** These endpoints are public and don't require authentication.

    ### Tour Endpoints

    #### List Tours (Public)

    ```http
    GET /api/common/tour?page=1&limit=12&themeId=heritage&cityId=jaipur-id&minPrice=20000&maxPrice=50000&sortBy=rating&order=desc
    ```

    **Query Parameters:**

    - `page`, `limit`: Pagination
    - `themeId`: Filter by theme
    - `cityId`: Filter by city
    - `minPrice`, `maxPrice`: Price range
    - `duration`: Filter by days (e.g., "5-7")
    - `search`: Full-text search
    - `isFeatured`: true (featured tours only)

    **Response:** Paginated tour list with filters applied

    #### Get Tour by Slug (Public)

    ```http
    GET /api/common/tour/{slug}
    ```

    **Response:** Full tour details including reviews, itinerary, pricing

    ### Query Submission Endpoints

    #### Submit Tour Query

    ```http
    POST /api/common/query/tour
    Content-Type: application/json

    {
    "fullName": "Jane Smith",
    "email": "jane@example.com",
    "phoneNumber": "9876543210",
    "tourId": "tour-cuid",
    "tourName": "Golden Triangle Tour",
    "numberOfPeople": 4,
    "travelDate": "2026-03-15",
    "budget": "40000-50000",
    "message": "Interested in customizing the itinerary"
    }
    ```

    **Response (201 Created):**

    ```json
    {
    "statusCode": 201,
    "success": true,
    "data": {
        "lead": {
        "referenceNumber": "LEAD-2026-0123",
        "id": "lead-cuid",
        "source": "TOUR_QUERY",
        "status": "NEW"
        }
    },
    "message": "Your query has been submitted. Reference: LEAD-2026-0123"
    }
    ```

    **Background Processing:**

    1. Create Lead record with source "TOUR_QUERY"
    2. Generate unique reference number
    3. Store query details in JSON `details` field
    4. Create LeadActivity entry: "Lead created"
    5. Send confirmation email to user
    6. Send notification to sales team
    7. (Optional) Sync to Zoho CRM if integration enabled

    #### Submit Hotel Query

    ```http
    POST /api/common/query/hotel

    {
    "fullName": "...",
    "email": "...",
    "phoneNumber": "...",
    "city": "Jaipur",
    "checkInDate": "2026-03-10",
    "checkOutDate": "2026-03-15",
    "numberOfRooms": 2,
    "numberOfGuests": 4,
    "hotelCategory": "4-star",
    "message": "..."
    }
    ```

    Creates lead with source "HOTEL_QUERY"

    ### POI (Points of Interest)

    #### Get All Monuments

    ```http
    GET /api/common/poi/monuments?page=1&limit=20&stateSlug=rajasthan&citySlug=jaipur&category=fort&search=amber
    ```

    **Response:**

    ```json
    {
    "statusCode": 200,
    "success": true,
    "data": {
        "monuments": [
        {
            "id": "monument-uuid",
            "slug": "amber-fort",
            "monumentName": "Amber Fort",
            "cityName": "Jaipur",
            "stateName": "Rajasthan",
            "typeofPlace": "Fort",
            "description": "Magnificent fort...",
            "besttime": "October to March",
            "openingtime": "08:00 AM",
            "clossingtime": "05:30 PM",
            "weeklyoff": "None",
            "entryFees": {
            "indian": 25,
            "foreigner": 200,
            "student": 10
            },
            "rating": 4.7,
            "totalRatings": 1234
        }
        ],
        "pagination": {
        /* pagination info */
        }
    },
    "message": "Monuments fetched successfully"
    }
    ```

    ### Travel Guide

    #### Get City Travel Guide

    ```http
    GET /api/common/travel-guide/cities/jaipur
    ```

    **Response:**

    ```json
    {
    "statusCode": 200,
    "success": true,
    "data": {
        "city": {
        "id": "city-id",
        "name": "Jaipur",
        "slug": "jaipur",
        "stateName": "Rajasthan",
        "cityImage": "https://...",
        "guideData": {
            "introduction": "Jaipur, the Pink City...",
            "facts": "Founded in 1727...",
            "bestTimeToVisit": "October to March",
            "placesToSeeTop": "Amber Fort, City Palace...",
            "foodAndDining": "Dal Baati Churma...",
            "shopping": "Johari Bazaar...",
            "gettingAround": "Metro, Auto-rickshaw...",
            "historyCulture": "Rich Rajput heritage...",
            "hotelDetails": "Wide range of hotels..."
        }
        }
    },
    "message": "Travel guide fetched successfully"
    }
    ```

    ---

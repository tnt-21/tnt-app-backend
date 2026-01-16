# Tails & Tales Backend API

The robust, production-ready backend for the **Tails & Tales** pet care platform. This API manages the entire ecosystem of users, pets, detailed health records, service bookings, subscriptions, and caregiver assignments.

---

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Directory Structure](#directory-structure)
- [Modules](#modules)
- [Key Components](#key-components)
  - [Middlewares](#middlewares)
  - [Utilities](#utilities)
  - [Configuration](#configuration)
  - [Cron Jobs](#scheduled-jobs-cron)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [Database Management](#database-management)
- [API Documentation](#api-documentation)

---

## 🏗 Architecture Overview

The application follows a **Layered Architecture** to ensure Separation of Concerns (SoC) and maintainability:

1.  **Routes Layer** (`/routes`): Defines API endpoints and maps them to controllers.
2.  **Controller Layer** (`/controllers`): Handles HTTP requests, parses input, triggers validation, and sends formatted responses.
3.  **Service Layer** (`/services`): Contains the core business logic. It interacts with the database and external APIs (Cloudinary, Razorpay, etc.).
4.  **Data Access**: Logic is centralized within services using raw SQL queries via `pg` pool for maximum performance and control.

---

## 📂 Directory Structure

```graphql
backend/
├── config/             # Environment & library configurations
│   ├── auth.js         # Auth strategies configuration
│   ├── database.js     # PostgreSQL connection pool (NeonDB)
│   └── upload.config.js # Multer & Cloudinary settings
├── controllers/        # Request handlers
├── cron/               # Scheduled background tasks
├── middlewares/        # Express middlewares
├── routes/             # API Route definitions (v1)
├── scripts/            # Database management scripts (Migrate/Seed)
├── services/           # Business logic & Database interactions
├── utils/              # Shared helper functions
└── uploads/            # Temp storage for local development
```

---

## 🧩 Modules

The application is modularized by feature. Each module typically consists of a Route, Controller, and Service file.

| Module | Description | Core Files |
| :--- | :--- | :--- |
| **Auth** | User authentication, OTP handling, JWT management. | `auth.routes.js`, `auth.controller.js`, `auth.service.js` |
| **User** | User profiles, address management, preferences. | `user.*.js` |
| **Pet** | Pet profiles, health records, vaccinations, growth tracking. | `pet.*.js` |
| **Service** | Service catalog, booking logic, slot availability. | `service.*.js`, `booking.*.js` |
| **Subscription** | Tier management, entitlement tracking, billing cycles. | `subscription.*.js` |
| **Payment** | Invoices, gateway integration (Razorpay), refunds. | `payment.*.js` |
| **Caregiver** | Caregiver specific profiles, assignments, availability. | `caregiver.*.js` |
| **Care Manager** | Managerial oversight, client onboarding, check-ins. | `careManager.*.js` |
| **Admin** | System configuration, user management, promotion logic. | `admin.*.js` |
| **Notification** | Push notifications, SMS logic, Email logic. | `notification.*.js` |
| **Config** | Dynamic configuration usage (pricing rules, etc.). | `config.*.js` |
| **Analytics** | Data aggregation and reporting. | `analytics.*.js` |
| **Community** | Social features (if applicable). | `community.*.js` |
| **Support** | Help desk and ticketing system. | `support.*.js` |
| **Tracking** | Real-time service tracking. | `tracking.*.js` |

---

## ⚙️ Key Components

### Middlewares
Located in `middlewares/`, these intercept requests to handle cross-cutting concerns.

-   **`auth.middleware.js`**: Verifies JWT Tokens (`authenticate`), handles optional auth (`optionalAuth`), and enforces Role-Based Access Control (`authorize('admin')`).
-   **`validation.middleware.js`**: Generic wrapper around Joi schemas to validate request bodies/params before controllers run.
-   **`rateLimit.middleware.js`**: Protects public routes (Auth/OTP) from brute-force attacks using `express-rate-limit`.
-   **`upload.middleware.js`**: Configures `multer` for handling `multipart/form-data` file uploads (memory vs disk storage).
-   **`error.middleware.js`**: Global error handling function. Catches exceptions, formats standardized JSON responses, and hides stack traces in production.

### Utilities
Located in `utils/`, providing shared functionality.

-   **`response.util.js`**: Standardizes API responses (`success`, `error`, `paginated`) to ensure consistent JSON structure across the app.
-   **`validation.util.js`**: Contains all Joi schemas for request validation (e.g., `createPetSchema`, `loginSchema`).
-   **`encryption.util.js`**: Helper methods for hashing (BCrypt) or encryption (Crypto) if needed outside standard auth.
-   **`audit.util.js`**: specialized utility for logging critical actions to the `audit_logs` database table.

### Configuration
Located in `config/`.

-   **`database.js`**: Configures the `pg` connection pool. Handles SSL connections for NeonDB and exposes a `query` helper method for services.
-   **`upload.config.js`**: Centralized configuration for file limits and allowed MIME types.

### Scheduled Jobs (Cron)
Located in `cron/`, powered by `node-cron`.

-   **`pet.cron.js`**: Runs daily at midnight. Automatically updates Pet Life Stages (e.g., Puppy -> Adult) based on date of birth.
-   **`keep_alive.cron.js`**: Pings the server periodically to prevent cold starts on hosting platforms like Render.

---

## 🚀 Setup & Installation

1.  **Clone the Repository**
    ```bash
    git clone <repo-url>
    cd backend
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Database Migration**
    Initialize the database logic.
    ```bash
    npm run db:setup  # Runs migrations and seeds master data
    ```

4.  **Run Locally**
    ```bash
    npm run dev      # Starts server with Nodemon (Hot Reload)
    ```

---

## 🌿 Environment Variables

Create a `.env` file in the root.

**Core**
```
PORT=5000
NODE_ENV=development
API_VERSION=v1
ALLOWED_ORIGINS=http://localhost:3000
```

**Database (NeonDB)**
```
DB_HOST=...
DB_PORT=5432
DB_NAME=tails_and_tales
DB_USER=...
DB_PASSWORD=...
DB_SSL=true
```

**Auth & Security**
```
JWT_SECRET=...        # Secret for signing tokens
ENCRYPTION_KEY=...    # Secret for data encryption
```

**Services**
```
# Razorpay (Payments)
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# Cloudinary (Images)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Msg91 / Twilio (SMS)
SMS_PROVIDER=msg91
MSG91_AUTH_KEY=...
```

---

## 🗄 Database Management

The project uses custom SQL-based migration scripts found in `/scripts`.

-   **Migrate**: `npm run db:migrate` - Creates tables from the schema definition.
-   **Seed**: `npm run db:seed` - Populates reference tables (Species, Roles, Tiers).
-   **Reset**: `npm run db:reset` - **CAUTION**: Drops all tables and re-initializes.

---

## 📖 API Documentation

The API strictly follows the specification defined in `backend_api_specification.md`.

**Base URL**: `/api/v1`

**Common Endpoints:**
-   `POST /api/v1/auth/send-otp`
-   `POST /api/v1/auth/verify-otp`
-   `GET /api/v1/users/me`
-   `GET /api/v1/pets`
-   `POST /api/v1/services/bookings`

*(See `backend_api_specification.md` for the full contract)*

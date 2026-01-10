# Tails & Tales - Backend API Specification

**Version:** 1.0.0
**Base URL:** `/api/v1`

## Overview

This document details the RESTful API endpoints for the Tails & Tales backend application.

- **Authentication:** Most endpoints require an `Authorization` header with a Bearer token.
- **Success Response:** `{ "success": true, "message": "...", "data": { ... } }`
- **Error Response:** `{ "success": false, "message": "...", "error_code": "..." }`

---

## 1. Authentication Module (`/auth`) [5 routes]

### Send OTP
**POST** `/auth/send-otp`
- **Description**: Sends a One-Time Password to the provided phone number.
- **Auth**: Public
- **Request Body**:
  ```json
  {
    "phone": "+919876543210" // required, 10-digit Indian number
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "OTP sent successfully",
    "data": {
      "otp_id": "12345",
      "expires_in": 300
    }
  }
  ```

### Verify OTP
**POST** `/auth/verify-otp`
- **Description**: Verifies OTP and logs in or registers the user.
- **Auth**: Public
- **Request Body**:
  ```json
  {
    "phone": "+919876543210", // required
    "otp": "123456", // required, 6 digits
    "device_type": "mobile", // optional: 'mobile' | 'web'
    "fcm_token": "token_string" // optional, for push notifications
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "user": { "user_id": "uuid", "full_name": "...", "role": "user" },
      "access_token": "jwt_token",
      "refresh_token": "jwt_token",
      "is_new_user": false
    }
  }
  ```

### Refresh Token
**POST** `/auth/refresh-token`
- **Description**: Generates a new access token using a valid refresh token.
- **Auth**: Public
- **Request Body**:
  ```json
  {
    "refresh_token": "valid_refresh_token_string" // required
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Token refreshed",
    "data": {
      "access_token": "new_jwt_token",
      "refresh_token": "new_refresh_token" // optional
    }
  }
  ```

### Logout
**POST** `/auth/logout`
- **Description**: Invalidates the current session/refresh token.
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "refresh_token": "token_to_invalidate" // optional, but recommended
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Logged out successfully"
  }
  ```

### Get Current User
**GET** `/auth/me`
- **Description**: Retrieves currently logged-in user details.
- **Auth**: Required
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "user_id": "uuid",
      "phone": "+91...",
      "email": "...",
      "role": "user"
    }
  }
  ```

---

## 2. User Module (`/users`) [22 routes]

### Profile & Account

#### Get Profile
**GET** `/users/me`
- **Description**: Get full user profile details.
- **Auth**: Required
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "user_id": "uuid",
      "full_name": "John Doe",
      "email": "john@example.com",
      "phone": "+919876543210",
      "profile_photo_url": "https://...",
      "date_of_birth": "1990-01-01",
      "gender": "male"
    }
  }
  ```

#### Update Profile
**PUT** `/users/me`
- **Description**: Update profile details.
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "full_name": "John Doe Updated", // min 2, max 255
    "email": "john.new@example.com", // valid email
    "date_of_birth": "1990-01-01",
    "gender": "male"
  }
  ```
- **Response**: Updated user object.

#### Upload Profile Photo
**POST** `/users/me/upload-photo`
- **Description**: Upload profile photo.
- **Auth**: Required
- **Request**: `multipart/form-data` with key `file`.
- **Response**:
  ```json
  {
    "success": true,
    "data": { "url": "https://s3..." }
  }
  ```

#### Delete Account
**DELETE** `/users/me`
- **Description**: Permanently delete user account.
- **Auth**: Required
- **Response**: Success message.

### Addresses

#### List Addresses
**GET** `/users/me/addresses`
- **Description**: List all saved addresses.
- **Auth**: Required
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "addresses": [
        {
          "address_id": "uuid",
          "label": "home",
          "address_line1": "...",
          "city": "...",
          "is_default": true
        }
      ]
    }
  }
  ```

#### Create Address
**POST** `/users/me/addresses`
- **Description**: Add a new address.
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "label": "home", // required: home/work/other
    "address_line1": "123 Main St", // required
    "address_line2": "Apt 4B",
    "landmark": "Near Park",
    "city": "Mumbai", // required
    "state": "Maharashtra", // required
    "pincode": "400001", // required, 6 digits
    "latitude": 19.0760,
    "longitude": 72.8777,
    "is_default": false
  }
  ```
- **Response**: Created address object.

#### Update Address
**PUT** `/users/me/addresses/:address_id`
- **Description**: Update an existing address.
- **Auth**: Required
- **Request Body**: Same as Create Address (all fields optional).
- **Response**: Updated address object.

#### Set Default Address
**PUT** `/users/me/addresses/:address_id/set-default`
- **Description**: Set specific address as default.
- **Auth**: Required
- **Response**: Success message.

#### Delete Address
**DELETE** `/users/me/addresses/:address_id`
- **Description**: Delete an address.
- **Auth**: Required
- **Response**: Success message.

### Preferences

#### Get Preferences
**GET** `/users/me/preferences`
- **Description**: Get application preferences.
- **Auth**: Required
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "language": "en",
      "theme": "light",
      "notification_enabled": true
    }
  }
  ```

#### Update Preferences
**PUT** `/users/me/preferences`
- **Description**: Update application preferences.
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "language": "en", // en/hi
    "theme": "dark", // light/dark/auto
    "notification_enabled": true,
    "whatsapp_enabled": true
  }
  ```
- **Response**: Updated preferences object.

### Notifications

#### Get Notification Settings
**GET** `/users/me/notification-preferences`
- **Description**: Get granular notification settings.
- **Auth**: Required
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "booking_confirmations": true,
      "health_reminders": true,
      "promotional": false,
      "quiet_hours_start": "22:00",
      "quiet_hours_end": "08:00"
    }
  }
  ```

#### Update Notification Settings
**PUT** `/users/me/notification-preferences`
- **Description**: Update granular notification settings.
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "booking_confirmations": true,
    "promotional": false,
    "quiet_hours_start": "23:00" // HH:MM
  }
  ```
- **Response**: Updated settings object.

### Sessions

#### List Sessions
**GET** `/users/me/sessions`
- **Description**: List all active login sessions.
- **Auth**: Required
- **Response**: List of session objects (device info, IP, last active).

#### Revoke Session
**DELETE** `/users/me/sessions/:session_id`
- **Description**: Logout a specific session.
- **Auth**: Required

#### Revoke All Other Sessions
**DELETE** `/users/me/sessions`
- **Description**: Logout all sessions except current.
- **Auth**: Required

### Contact Updates

#### Request Phone Update
**POST** `/users/me/phone/request-update`
- **Description**: Request OTP to update phone number.
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "new_phone": "+919876543210" // required
  }
  ```

#### Verify & Update Phone
**PUT** `/users/me/phone`
- **Description**: Verify OTP and update phone number.
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "new_phone": "+919876543210",
    "otp": "123456"
  }
  ```

#### Request Email Update
**POST** `/users/me/email/request-update`
- **Description**: Request OTP to verify new email.
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "new_email": "new@example.com"
  }
  ```

#### Verify & Update Email
**PUT** `/users/me/email`
- **Description**: Verify OTP and update email.
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "new_email": "new@example.com",
    "otp": "123456"
  }
  ```

---

## 3. Pet Module (`/pets`) [28 routes]

### Pet Management

#### List Pets
**GET** `/pets`
- **Response**: `{ "success": true, "data": { "pets": [...] } }`

#### Get Pet
**GET** `/pets/:pet_id`
- **Response**: Pet details object.

#### Create Pet
**POST** `/pets`
- **Request Body**:
  ```json
  {
    "name": "Buddy", // required, max 100
    "species_id": 1, // required
    "breed": "Golden Retriever",
    "date_of_birth": "2020-01-01", // required
    "gender_id": 1,
    "weight": 25.5,
    "color": "Golden",
    "microchip_id": "1234567890"
  }
  ```
- **Response**: Created Pet object.

#### Update Pet
**PUT** `/pets/:pet_id`
- **Request Body**: Same as Create (all optional).
- **Response**: Updated Pet object.

#### Upload Photo
**POST** `/pets/:pet_id/upload-photo`
- **Request**: Multipart file.

#### Deceased
**POST** `/pets/:pet_id/mark-deceased`
- **Request Body**: `{ "deceased_date": "2023-01-01" }`

### Health Records
#### Create Health Record
**POST** `/pets/:pet_id/health-records`
- **Request Body**:
  ```json
  {
    "record_type": "vet_visit", // required: vaccination/vet_visit/medication/etc
    "title": "Annual Checkup", // required
    "record_date": "2023-01-01", // required
    "notes": "Healthy",
    "cost": 500
  }
  ```

#### Manage Records
**GET** `/pets/:pet_id/health-records` - List
**PUT** `/pets/:pet_id/health-records/:id` - Update
**DELETE** `/pets/:pet_id/health-records/:id` - Delete

### Vaccinations
#### Add Vaccination
**POST** `/pets/:pet_id/vaccinations`
- **Request Body**:
  ```json
  {
    "vaccine_name": "Rabies", // required
    "vaccination_date": "2023-01-01", // required
    "next_due_date": "2024-01-01",
    "veterinarian_name": "Dr. Smith"
  }
  ```

### Medications
#### Add Medication
**POST** `/pets/:pet_id/medications`
- **Request Body**:
  ```json
  {
    "medication_name": "Apoquel", // required
    "dosage": "5mg", // required
    "frequency": "Once daily", // required
    "start_date": "2023-01-01", // required
    "reminder_enabled": true,
    "reminder_times": ["09:00"]
  }
  ```

### Insurance
#### Add Insurance
**POST** `/pets/:pet_id/insurance`
- **Request Body**:
  ```json
  {
    "insurer_name": "PetCover", // required
    "policy_number": "POL123", // required
    "start_date": "...",
    "end_date": "..."
  }
  ```

### Growth Tracking
#### Add Growth Record
**POST** `/pets/:pet_id/growth`
- **Request Body**:
  ```json
  {
    "measurement_date": "2023-01-01", // required
    "weight": 26.0,
    "height": 50.0
  }
  ```

---

## 4. Service Module (`/services`) [14 routes]

### Catalog
**GET** `/services/catalog` - List services (Query: `category_id`, `search`)
**GET** `/services/catalog/:service_id` - Get details
**GET** `/services/catalog/:service_id/slots` - Get Slots
- **Query**: `date=YYYY-MM-DD`, `location_type_id=1`
- **Response**: `{ "slots": ["09:00:00", "10:00:00"] }`

### Bookings
#### Calculate Price
**POST** `/services/bookings/calculate-price`
- **Request Body**:
  ```json
  {
    "service_id": "uuid",
    "pet_id": "uuid",
    "addons": [{ "addon_type": "product", "addon_name": "Shampoo", "unit_price": 50 }],
    "promo_code": "DISCOUNT10"
  }
  ```
- **Response**: breakdown of costs.

#### Create Booking
**POST** `/services/bookings`
- **Request Body**:
  ```json
  {
    "service_id": "uuid", // required
    "pet_id": "uuid", // required
    "booking_date": "2024-01-01", // required
    "booking_time": "09:00:00", // required
    "location_type_id": 1, // required
    "address_id": "uuid", // optional
    "addons": [...],
    "use_subscription": false
  }
  ```

#### Manage Bookings
**GET** `/services/bookings` - List
**POST** `/services/bookings/:id/cancel` - Cancel
- **Request**: `{ "reason": "Change of plans" }`
**POST** `/services/bookings/:id/reschedule`
- **Request**: `{ "new_date": "...", "new_time": "...", "reason": "..." }`

---

## 5. Subscription Module (`/subscriptions`) [16 routes]

### Management
**GET** `/subscriptions/tiers` - Browse Tiers

### User Subscriptions
#### Purchase Subscription
**POST** `/subscriptions/me/subscriptions`
- **Request Body**:
  ```json
  {
    "pet_id": "uuid", // required
    "tier_id": 1, // required
    "billing_cycle_id": 1, // required
    "promo_code": "WELCOME"
  }
  ```

#### Manage Features
**POST** `/subscriptions/me/subscriptions/:id/upgrade` - Upgrade
- **Request**: `{ "new_tier_id": 2 }`
**POST** `/subscriptions/me/subscriptions/:id/cancel` - Cancel
- **Request**: `{ "reason": "Too expensive", "immediate": false }`
**POST** `/subscriptions/me/subscriptions/:id/pause` - Pause
- **Request**: `{ "reason": "Travel", "resume_date": "2024-02-01" }`
**PUT** `/subscriptions/me/subscriptions/:id/auto-renew` - Toggle Renewal
- **Request**: `{ "auto_renew": false }`

#### Tools
**POST** `/subscriptions/validate-promo`
- **Request**: `{ "promo_code": "...", "tier_id": 1 }`
**POST** `/subscriptions/calculate-price`
- **Request**: `{ "tier_id": 1, "billing_cycle_id": 1, "promo_code": "..." }`

---

## 6. Payment Module (`/payments`) [16 routes]

### Payment Methods
#### Add Method
**POST** `/payments/methods`
- **Request Body**:
  ```json
  {
    "method_type": "card", // required: card/upi/netbanking
    "provider": "razorpay", // required
    "token": "tok_12345", // required from gateway
    "last_four": "1234", "card_brand": "visa"
  }
  ```

### Processing
#### Process Payment
**POST** `/payments/process`
- **Request Body**:
  ```json
  {
    "invoice_id": "uuid", // required
    "payment_gateway": "razorpay"
  }
  ```

#### Verify Payment
**POST** `/payments/verify/:payment_id`
- **Request Body**: `{ "order_id": "...", "payment_id": "...", "signature": "..." }`

### Refunds & Invoices
**POST** `/payments/refunds` - Request Refund
- **Request**: `{ "payment_id": "...", "refund_amount": 100, "reason": "Duplicate charge" }`
**POST** `/payments/invoices` - Create Invoice
**GET** `/payments/invoices` - List Invoices
**GET** `/payments/invoices/:id/download` - Get PDF URL

---

## 7. Caregiver Module (`/caregivers`) [21 routes]

### Profile & Availability
#### Update Profile
**PUT** `/caregivers/me`
- **Request Body**: `updateCaregiverProfileSchema`
  ```json
  {
    "full_name": "...",
    "experience_years": 5,
    "service_area_pincodes": ["400001", "400002"]
  }
  ```

#### Specializations
**POST** `/caregivers/me/specializations`
- **Request Body**:
  ```json
  {
    "category_id": 1,
    "proficiency_level": "expert"
  }
  ```

#### Availability
**POST** `/caregivers/me/availability`
- **Request Body**:
  ```json
  {
    "date": "2024-01-01",
    "start_time": "09:00",
    "end_time": "17:00",
    "is_available": true
  }
  ```

### Assignments
#### Manage Assignment
**POST** `/caregivers/me/assignments/:id/accept` - Accept
**POST** `/caregivers/me/assignments/:id/reject` - Reject
- **Request**: `{ "rejection_reason": "Distance too far" }`

#### Service Execution
**POST** `/caregivers/me/assignments/:id/start` - Check In
- **Request**: `{ "latitude": 19.0, "longitude": 72.0 }`
**POST** `/caregivers/me/assignments/:id/complete` - Check Out
- **Request Body**: `completeServiceSchema`
  ```json
  {
    "service_notes": "Walked 2km",
    "pet_behavior_observed": "Happy",
    "before_photos": ["url1"],
    "after_photos": ["url2"]
  }
  ```

---

## 8. Care Manager Module (`/care-managers`) [15 routes]

### Client Management
#### Onboarding
**POST** `/care-managers/me/assignments/:id/complete-onboarding`
- **Request**: `{ "notes": "...", "care_plan_url": "..." }`

#### Check-Ins
**POST** `/care-managers/me/assignments/:id/schedule-check-in`
- **Request**: `{ "next_check_in_date": "2024-02-01T10:00:00Z" }`
**PUT** `/care-managers/me/assignments/:id/check-in-frequency`
- **Request**: `{ "check_in_frequency": "weekly" }`

### Interactions
#### Log Interaction
**POST** `/care-managers/me/assignments/:id/interactions`
- **Request Body**: `logInteractionSchema`
  ```json
  {
    "interaction_type": "phone_call",
    "summary": "Discussed diet plan",
    "duration_minutes": 15,
    "action_items": [{ "item": "Send verification email", "due_date": "..." }]
  }
  ```

---

## 9. Admin Module (`/admin`) [14 routes]

### Tier & Config Management
#### Update Tier
**PATCH** `/admin/tiers/:tierId`
- **Auth**: Admin
- **Request Body**:
  ```json
  {
    "name": "Gold",
    "is_active": true,
    "benefits": ["priority_support"]
  }
  ```

#### Update Tier Config
**POST** `/admin/tiers/:tierId/config`
- **Auth**: Admin
- **Request Body**: (Configuration object specific to tier logic)

### Caregiver Management
#### Create Caregiver
**POST** `/admin/caregivers`
- **Auth**: Admin
- **Request Body**: (See Caregiver Profile Schema)
  ```json
  {
    "full_name": "...",
    "email": "...",
    "phone": "..."
  }
  ```

#### Manage Caregivers
**GET** `/admin/caregivers` - List all caregivers
**GET** `/admin/caregivers/:id` - Get details
**PUT** `/admin/caregivers/:id` - Update details
**DELETE** `/admin/caregivers/:id` - Remove caregiver

#### Promote User
**POST** `/admin/caregivers/:userId/promote`
- **Auth**: Admin
- **Description**: Convert existing user to caregiver role.

### Care Manager Management
#### Create/Promote
**POST** `/admin/care-managers` - Create new
**POST** `/admin/care-managers/:userId/promote` - Promote existing user

#### Manage
**GET** `/admin/care-managers` - List all
**GET** `/admin/care-managers/:id` - Get details
**PUT** `/admin/care-managers/:id` - Update
**DELETE** `/admin/care-managers/:id` - Remove

---

## 10. Config Module (`/config`) [21 routes]

### Pricing Rules
**GET** `/config/pricing-rules` - List all rules
**POST** `/config/pricing-rules` - Create Rule
- **Request Body**:
  ```json
  {
    "rule_name": "Peak Hour Surcharge", // required
    "service_id": "uuid",
    "price_modifier": 1.2, // 20% increase
    "modifier_type": "percentage",
    "time_start": "18:00",
    "time_end": "22:00"
  }
  ```
**PUT** `/config/pricing-rules/:rule_id` - Update Rule
**DELETE** `/config/pricing-rules/:rule_id` - Delete Rule

### Fair Usage Policies
**GET** `/config/fair-usage` - List policies
**POST** `/config/fair-usage` - Create Policy
- **Request Body**:
  ```json
  {
    "tier_id": 1,
    "category_id": 1,
    "max_usage_per_month": 10,
    "abuse_action": "warn"
  }
  ```
**PUT** `/config/fair-usage/:policy_id` - Update Policy

### Promo Codes
**GET** `/config/promo-codes` - List
**POST** `/config/promo-codes` - Create
- **Request Body**:
  ```json
  {
    "promo_code": "SUMMER50", // required
    "promo_name": "Summer Sale",
    "discount_type": "percentage",
    "discount_value": 50,
    "valid_from": "2024-06-01",
    "valid_until": "2024-06-30"
  }
  ```
**PUT** `/config/promo-codes/:promo_id` - Update
**DELETE** `/config/promo-codes/:promo_id` - Delete

#### Validate Promo (User)
**POST** `/config/promo-codes/validate`
- **Request**: `{ "promo_code": "SUMMER50", "amount": 1000 }`
- **Response**: `{ "is_valid": true, "discount_amount": 500, "final_amount": 500 }`

### App Settings
**GET** `/config/settings` - Private admin settings
**GET** `/config/settings/public` - Public usage settings
**POST** `/config/settings` - Upsert Setting
- **Request**: `{ "setting_key": "app_version", "setting_value": "1.0.0", "type": "string" }`
**DELETE** `/config/settings/:key` - Delete

### System Alerts
**POST** `/config/alerts` - Create Alert
- **Request**:
  ```json
  {
    "alert_type": "maintenance",
    "title": "Scheduled Maintenance",
    "message": "We will be down at 2 AM",
    "start_time": "..."
  }
  ```
**GET** `/config/alerts` - Get active alerts (User visible)
**PUT** `/config/alerts/:alert_id/deactivate` - Stop alert

---

## 11. Notification Module (`/notifications`) [12 routes]

### Management
**GET** `/notifications` - List (Query: `is_read`, `type`)
**PUT** `/notifications/:id/read` - Mark read
**PUT** `/notifications/read-all` - Mark all read
**DELETE** `/notifications/clear-read` - Delete all read

### Preferences
**PUT** `/notifications/preferences`
- **Request Body**: `updateNotificationPreferencesSchema`
  ```json
  {
    "booking_reminders": true,
    "email_enabled": false
  }
  ```

### Admin Sending
**POST** `/notifications/send`
- **Request**: `{ "user_id": "...", "title": "...", "message": "...", "type": "promo" }`
**POST** `/notifications/send-bulk`
- **Request**: `{ "user_ids": ["..."], "title": "...", "message": "..." }`

## 12. Analytics Module (`/analytics`) [11 routes]

### Event Tracking
**POST** `/analytics/track`
- **Request Body**:
  ```json
  {
    "event_type": "button_click",
    "event_name": "book_now_pressed",
    "page_url": "/services/123"
  }
  ```

### Reporting (Admin)
**GET** `/analytics/metrics` - Business KPIs
**GET** `/analytics/dashboard` - Dashboard Data
**GET** `/analytics/reports` - Generate Report
- **Query**: `type=revenue`, `start_date=...`

---

## 13. Tracking Module (`/tracking`) [8 routes]

### Sessions
#### Start Session (Caregiver)
**POST** `/tracking/sessions`
- **Request Body**:
  ```json
  {
    "booking_id": "uuid",
    "pet_id": "uuid",
    "session_type": "service_tracking"
  }
  ```

#### Update Location
**PUT** `/tracking/sessions/:session_id/location`
- **Request Body**:
  ```json
  {
    "latitude": 19.0,
    "longitude": 72.0,
    "speed": 5,
    "battery_level": 85
  }
  ```

#### Trip Info
**POST** `/tracking/sessions/:session_id/calculate-eta`
- **Request**: `{ "destination_lat": 19.1, "destination_lng": 72.1 }`
- **Response**: `{ "eta_seconds": 600, "distance_meters": 1500 }`

---

## 14. Community Module (`/community`) [7 routes]

### Events
**GET** `/community/events` - List Events
**POST** `/community/events/:id/register`
- **Request**: `{ "pet_id": "...", "special_requirements": "..." }`
**POST** `/community/events/:id/waitlist`
- **Request**: `{ "pet_id": "..." }`
**POST** `/community/registrations/:id/cancel`
- **Request**: `{ "cancellation_reason": "Sick pet" }`
**POST** `/community/registrations/:id/feedback`
- **Request**: `{ "feedback_rating": 5, "feedback_text": "Great event!" }`

## 15. Support Module (`/support`) [9 routes]

### Tickets
#### Create Ticket
**POST** `/support/tickets`
- **Request Body**:
  ```json
  {
    "subject": "App Issue", // required
    "description": "App crashes on login", // required
    "category": "technical", // required
    "priority": "high",
    "attachments": ["url1"]
  }
  ```

#### Message & Actions
**POST** `/support/tickets/:id/messages`
- **Request**: `{ "message": "Still facing issue", "attachments": [] }`
**POST** `/support/tickets/:id/close`
- **Request**: `{ "customer_satisfaction_rating": 4 }`
**POST** `/support/tickets/:id/reopen`
- **Request**: `{ "reason": "Issue persists" }`
**POST** `/support/upload-attachment`
- **Request**: Multipart file.

---
**End of Specification**

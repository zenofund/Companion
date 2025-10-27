# fliQ - Geolocation-Based Companion Booking Platform

## Overview

fliQ is a real-time, geolocation-based web application designed to connect clients with verified professional companions through an interactive map interface. Inspired by Uber, it offers secure payment processing, real-time messaging, and multi-role dashboards for clients, companions, and administrators. The platform aims to revolutionize companion booking by providing a safe, efficient, and transparent service.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**October 27, 2025 - Fixed Booking Dashboard Display Bug**
- Fixed critical Express route ordering bug preventing bookings from appearing on dashboards
- Moved GET /api/bookings/:id route to come AFTER all specific routes (/client, /pending, etc.)
- Previous issue: parameterized :id route was matching "/client" and treating it as a booking ID
- Bookings now properly display on both client and companion dashboards
- Also fixed TypeScript errors: removed invalid `status` field and changed `getUserById()` to `getUser()`
- Updated insertBookingSchema to allow `requestExpiresAt` field for 24-hour expiry tracking

**October 27, 2025 - Restored Booking Workflow & Added Dispute System**
- Restructured booking flow to match correct workflow: request → companion accepts → payment → chat → complete → confirm/dispute
- Booking creation now sends pending request to companion (no immediate payment)
- Payment initialization moved to companion accept endpoint - triggers when companion accepts request
- Added "disputed" status to booking enum for handling completion disputes
- Created POST /api/bookings/:id/dispute endpoint for clients to dispute completion requests
- Added GET /api/bookings/:id endpoint to fix "Booking not found" error in chat
- Updated Client Dashboard with both Confirm and Dispute buttons for pending completions
- Dispute button allows clients to reject fraudulent completion claims
- BookingModal now shows success message instead of redirecting to payment immediately
- Extended booking request expiry from 15 minutes to 24 hours for companion review
- Chat now accessible after companion accepts and payment is processed

**October 27, 2025 - Client Confirmation System with 48-Hour Auto-Completion**
- Implemented fraud prevention system requiring client confirmation before booking completion
- Added `pending_completion` status to bookings enum and `completionRequestedAt` timestamp field
- Modified companion "Complete" button to "Request Completion" - sets booking to pending_completion
- Created `/api/bookings/:id/confirm-completion` endpoint for clients to confirm service completion
- Added `/api/bookings/client/pending-completion` endpoint with automatic expiry processing
- Implemented `autoCompleteExpiredRequests()` helper that auto-completes bookings after 48 hours
- Added "Awaiting Your Confirmation" section to Client Dashboard with countdown timer
- Added "Awaiting Client Confirmation" section to Companion Dashboard showing pending requests
- Yellow-highlighted cards show hours remaining until auto-completion
- Auto-completion runs whenever client checks their pending completion bookings
- Protects clients from unscrupulous companions while not indefinitely holding companion payments

**October 26, 2025 - Payment Redirect & Companion Booking Management**
- Fixed Paystack payment callback URL to use proper https protocol with REPLIT_DEV_DOMAIN
- Added comprehensive logging throughout payment flow for easier debugging
- Created `/api/bookings/companion/active` endpoint to fetch accepted/active bookings for companions
- Added `getActiveBookings` method to storage layer with client information joins
- Implemented Active Bookings section in Companion Dashboard showing all accepted/in-progress bookings
- Added Chat button to open booking chat and Complete button to mark bookings as finished
- Created `/api/bookings/:id/complete` route for companions to complete bookings
- Payment redirect now works correctly: Paystack → callback route → dashboard with success toast

**October 25, 2025 - Logo Mobile Fix**
- Fixed logo in header to resize proportionately on mobile devices
- Logo now uses responsive height (smaller on mobile, larger on desktop)
- Added `w-auto object-contain` to maintain aspect ratio and prevent stretching
- Mobile logo is 32px height, desktop is 40px height with automatic width scaling

**October 25, 2025 - Booking Payment Fix & Complete Flow**
- Redesigned booking modal with simple native HTML5 date and time inputs
- Uses device's built-in calendar picker for clean, reliable date selection
- Fixed backend validation to use custom Zod schema that transforms ISO date strings to Date objects
- Separated date and time fields with proper form validation for both
- Fixed Paystack payment flow - now properly creates booking and redirects to payment
- Backend correctly handles ISO string dates from frontend and converts them for database
- Added payment callback route that redirects users back to dashboard after payment
- Payment success/failure notifications displayed via toast messages
- Complete booking flow: Form → Paystack → Payment → Dashboard with confirmation

**October 25, 2025 - Authentication & Mobile UX Fixes**
- Fixed critical authentication bug where users appeared logged out when viewing companion profiles
- Added proper user prop passing to Header component across all CompanionProfile page states
- Redesigned CompanionCard mobile layout to single-column stacked format with icons beside values
- Stats now display horizontally (icon + value) and stack vertically on mobile for better readability
- Companion names now properly truncate on small screens to prevent overflow
- Improved responsive text sizing and spacing for mobile devices

**October 25, 2025 - Booking UX & Mobile Improvements**
- Fixed date picker in booking modal to properly update form field when date is selected
- Made companion cards fully mobile-responsive with 4-column grid layout
- Redesigned stats display with icons above values (Rate, City, Age, Rating) for compact mobile view
- Reduced padding and text sizes on mobile for tighter, more efficient layout
- Auth guard already in place - redirects users to login when booking without authentication

**October 25, 2025 - Dark Mode & Spacing Improvements**
- Implemented comprehensive dark mode theme with ThemeProvider component
- Added theme toggle button (sun/moon icon) in navigation header
- Theme persists to localStorage and respects system preferences as default
- All components automatically adapt via existing CSS color variables with excellent contrast
- Increased dashboard spacing from 64px to 112px top margin for better visual separation from header

**October 25, 2025 - Production Authentication Fix**
- Fixed critical production authentication bug by adding `trust proxy` setting to Express
- This enables proper HTTPS detection when deployed behind reverse proxies (Replit infrastructure)
- Secure cookies now work correctly in production, resolving "access denied" errors

**October 25, 2025 - UI/UX Improvements**
- Converted profile editing from full-page modal to Sheet (side drawer overlay) for better UX
- Created BankSetupModal component that wraps bank account setup in a Dialog for cleaner presentation
- Integrated BankSetupModal into EditProfileSheet, allowing nested modal within overlay
- Maintained all existing functionality while improving visual hierarchy and user flow

## System Architecture

### Frontend

**Technology Stack:** React with TypeScript, Wouter for routing, TanStack Query for state management, TailwindCSS with a custom design system, Radix UI and shadcn/ui for components, and Lucide React for icons.

**Design System:** Features a map-first, mobile-responsive design, Inter and Poppins fonts, a custom HSL-based color system, and Tailwind-based spacing and elevation.

**Key Pages:** Includes a landing page with map/list view, detailed companion profiles, client and companion dashboards, a real-time booking chat, and an admin dashboard.

### Backend

**Technology Stack:** Node.js with Express.js and TypeScript. Uses session-based authentication with HTTP-only cookies and role-based access control.

**Real-time Communication:** Implements a WebSocket server for secure, real-time chat messaging with authentication and booking membership verification.

**API Endpoints Pattern:** Organized RESTful API for authentication, companion management, booking operations, payment processing, chat messaging, and admin functions.

### Data Storage

**Database:** Neon Serverless PostgreSQL, managed with Drizzle ORM for type-safe queries and schema migrations.

**Schema Design:** Core tables include `users`, `companions`, `bookings`, `payments`, `messages`, `ratings`, `admin_settings`, and `admin_logs`. Geolocation data is stored with high precision for distance-based searches.

**Moderation System:** Integrates a moderation system for companion profiles and content, allowing for pending, approved, and rejected statuses.

## External Dependencies

**Payment Integration:** Paystack for secure payment processing, including split payments to companions, bank account verification, and webhook handling.

**AI Content Moderation:** OpenAI's Moderation API for text and GPT-5 Vision API for image analysis, ensuring content safety and flagging for admin review.

**Real-time Services:** Native WebSocket implementation for chat, self-hosted without external service dependencies.

**Frontend Assets:** Google Fonts for Inter and Poppins font families.
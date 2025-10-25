# fliQ - Geolocation-Based Companion Booking Platform

## Overview

fliQ is a real-time, geolocation-based web application for booking professional companions, inspired by Uber's map-centric interface. The platform connects clients with verified companions through an interactive map view, secure payment processing, and real-time messaging capabilities.

**Core Features:**
- Interactive map-based companion discovery with geolocation
- Real-time booking requests with 15-minute acceptance windows
- Secure payment processing via Paystack split payments
- AI-powered content moderation for safety
- WebSocket-based real-time chat for active bookings
- Multi-role dashboards (Client, Companion, Admin)
- Profile verification and moderation system

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- **Framework:** React with TypeScript
- **Routing:** Wouter (lightweight client-side routing)
- **State Management:** TanStack Query (React Query) for server state
- **Styling:** TailwindCSS with custom design system
- **UI Components:** Radix UI primitives with shadcn/ui component library
- **Icons:** Lucide React

**Design System:**
- Typography: Inter (UI/body), Poppins (headings/CTAs)
- Map-first, mobile-responsive interface
- Custom color system with HSL-based theming
- Spacing based on Tailwind primitives (2, 4, 8, 12, 16, 24)
- Elevation system for depth (hover-elevate, active-elevate-2)

**Key Pages:**
- Landing: Map/list view toggle for browsing companions
- Companion Profile: Detailed view with booking modal
- Client Dashboard: Booking management and history
- Companion Dashboard: Request handling and availability
- Booking Chat: Real-time messaging for active bookings with booking details sidebar
- Admin Dashboard: Platform oversight and moderation

### Backend Architecture

**Technology Stack:**
- **Runtime:** Node.js with Express.js
- **Language:** TypeScript with ES modules
- **Session Management:** express-session with MemoryStore
- **API Architecture:** RESTful endpoints with WebSocket support

**Authentication & Sessions:**
- Session-based authentication (no JWT)
- HTTP-only cookies for security
- Session secret configured via environment variables
- 7-day session lifetime
- Role-based access control (client, companion, admin)

**Real-time Communication:**
- WebSocket server for chat messaging at path `/ws`
- User authentication validation on connection
- Booking membership verification before message broadcast
- Server-side message echo to all participants (including sender)
- Error handling for unauthorized access attempts
- Automatic reconnection on disconnect
- Client connection tracking with user ID mapping

**API Endpoints Pattern:**
- User authentication: `/api/auth/*`
- Companion management: `/api/companions/*`
- Booking operations: `/api/bookings/*`
- Payment processing: `/api/payments/*`
- Chat messaging: 
  - WebSocket `/ws` for real-time messaging
  - GET `/api/bookings/:bookingId/messages` for message history
  - POST `/api/bookings/:bookingId/messages/read` to mark messages as read
- Admin operations: `/api/admin/*`

### Data Storage Architecture

**Database:**
- **Provider:** Neon Serverless PostgreSQL
- **ORM:** Drizzle ORM with type-safe queries
- **Migration Strategy:** Schema-first with drizzle-kit

**Schema Design:**

Core Tables:
- `users`: Authentication and base profile (email, password, role, avatar, verification status)
- `companions`: Extended profile for companions (location, bio, services, rates, availability)
- `bookings`: Booking records with status tracking (pending, accepted, active, completed, etc.)
- `payments`: Payment transactions linked to bookings
- `messages`: Chat messages for active bookings
- `ratings`: Post-booking reviews
- `admin_settings`: Platform configuration (split percentages, etc.)
- `admin_logs`: Audit trail for admin actions

**Key Relationships:**
- User → Companion (one-to-one, cascade delete)
- Client (User) → Bookings (one-to-many)
- Companion → Bookings (one-to-many)
- Booking → Payment (one-to-one)
- Booking → Messages (one-to-many)

**Geolocation Strategy:**
- Latitude/longitude stored as decimal(10,7) for precision
- Client-side geolocation API for user position
- Distance-based companion search queries

**Moderation System:**
- Enum status: pending, approved, rejected
- Applied to companion profiles and uploaded content
- Gallery images stored as text arrays (URLs)

### External Dependencies

**Payment Integration: Paystack**
- Initialize payment transactions
- Verify payment completion
- Split payment subaccounts for companions
- Bank account verification
- Webhook handling for payment events
- Base URL: `https://api.paystack.co`
- Authentication: Bearer token (PAYSTACK_SECRET_KEY)

**AI Content Moderation: OpenAI**
- Text moderation via Moderation API
- Image analysis via GPT-5 Vision API
- Safety checks before content publication
- Flagged content held for admin review
- API Key: OPENAI_API_KEY environment variable

**Real-time Services: WebSocket (ws)**
- Native WebSocket implementation for chat
- No external service dependency (self-hosted)
- Server-side client connection management

**Frontend Assets:**
- Google Fonts: Inter and Poppins font families
- Preconnect optimization for font loading

**Development Tools:**
- Vite for development server and build
- Replit-specific plugins (runtime error overlay, cartographer, dev banner)
- ESBuild for server-side bundling

**Environment Variables Required:**
- `DATABASE_URL`: Neon PostgreSQL connection string
- `SESSION_SECRET`: Session encryption key
- `PAYSTACK_SECRET_KEY`: Paystack API authentication
- `OPENAI_API_KEY`: OpenAI API authentication
- `NODE_ENV`: Environment mode (development/production)
- `REPLIT_DEV_DOMAIN`: Deployment domain for callbacks

**Security Considerations:**
- Password hashing via bcryptjs
- CSRF protection through SameSite cookies
- Content moderation before publication
- Role-based authorization checks
- Secure payment handling (no client-side secrets)
- WebSocket authentication:
  - Session cookie signature verification using cookie-signature
  - Session store validation to extract authenticated user ID
  - No client-provided user IDs trusted - all authentication session-based
  - Booking membership verification before message operations
  - Authorization checks prevent cross-booking message access
  - Error responses for all failure cases (missing cookie, invalid signature, expired session, unauthorized access)

## Recent Changes

### Real-time Chat Implementation (Completed)
**Date:** October 25, 2025

**Features Implemented:**
1. **WebSocket Infrastructure:**
   - Custom WebSocket hook (`useWebSocket`) for connection management
   - Automatic reconnection on disconnect
   - Connection status indicator
   - Error handling and logging

2. **Chat UI Component:**
   - Message bubbles with distinct colors (green for sender, yellow for receiver)
   - Timestamp display in 12-hour format
   - Auto-scroll to latest message
   - Input field with send button
   - Loading states and empty states

3. **Booking Chat Page:**
   - Integrated chat with booking details sidebar
   - Displays booking status, date, location, amount
   - Shows special requests if any
   - Navigation back to dashboard
   - Responsive layout (sidebar + chat)

4. **Security Enhancements:**
   - User validation on WebSocket connection
   - Booking membership verification before message broadcast
   - Only booking participants (client and companion) can access chat
   - Server echoes messages to all participants including sender
   - Prevents unauthorized cross-booking message access

5. **API Endpoints:**
   - GET `/api/bookings/:bookingId/messages` - Fetch message history with authorization
   - POST `/api/bookings/:bookingId/messages/read` - Mark messages as read
   - WebSocket `/ws` - Real-time messaging with auth and error handling

**Technical Implementation:**
- Message history fetched via REST API on page load
- Real-time updates via WebSocket
- Server-side message echo eliminates optimistic update failures
- Duplicate message detection by ID prevents display issues
- Companion user ID resolution for proper participant identification

**Security Implementation:**
- WebSocket connections validate session cookies using cookie-signature library
- Session signatures verified with SESSION_SECRET before trusting session data
- Authenticated user ID extracted from validated session (never from client)
- All message operations check booking membership for authenticated user
- Prevents impersonation, session hijacking, and cross-booking access
- Production-ready with comprehensive security validation

### Admin Dashboard Implementation (Completed)
**Date:** October 25, 2025

**Features Implemented:**
1. **Platform Statistics Overview:**
   - Total users count
   - Total companions count
   - Total bookings count
   - Platform revenue (Naira)
   - Pending moderation count
   - Loading skeletons for all metrics

2. **Companion Moderation System:**
   - View pending companion profiles with user details
   - Approve companion profiles with one click
   - Reject companion profiles with reason input
   - Display companion bio, city, hourly rate, submission date
   - Loading spinner during data fetch
   - Empty state for no pending companions

3. **Platform Settings Management:**
   - Configure platform fee percentage (0-100%)
   - Live calculation showing companion earnings split
   - Form validation prevents invalid values
   - Loading skeleton during settings fetch
   - Automatic save and cache invalidation

4. **Admin Activity Logs:**
   - Chronological log of all admin actions
   - Action type badges (Approved Companion, Rejected Companion, Updated Platform Fee)
   - Timestamp display with date and time
   - Admin name/email attribution
   - JSON details for complex actions
   - Loading spinner during log fetch

5. **API Endpoints:**
   - GET `/api/admin/stats` - Platform statistics
   - GET `/api/admin/pending-companions` - Companions awaiting approval
   - POST `/api/admin/companions/:id/approve` - Approve companion profile
   - POST `/api/admin/companions/:id/reject` - Reject companion profile with reason
   - GET `/api/admin/settings` - Fetch platform settings
   - PATCH `/api/admin/settings` - Update platform settings
   - GET `/api/admin/logs` - Fetch admin activity logs

**Technical Implementation:**
- Session-based admin role verification on all endpoints
- TanStack Query for data fetching with loading states
- Optimistic UI updates with cache invalidation
- Toast notifications for success/error feedback
- Backend error messages surfaced to frontend
- Activity logging for audit trail (all approve/reject/settings actions)

**Security & UX:**
- Admin role check on every endpoint prevents unauthorized access
- Loading state during authentication prevents Access Denied flash
- Loading skeletons/spinners prevent empty state flicker
- Mutation buttons disabled during pending requests
- Form validation prevents invalid platform fee values
- Production-ready with comprehensive error handling
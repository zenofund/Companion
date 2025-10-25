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
- WebSocket server for chat messaging
- Connection path: `/ws`
- Client-based connection tracking with user ID mapping
- Message broadcasting to specific users

**API Endpoints Pattern:**
- User authentication: `/api/auth/*`
- Companion management: `/api/companions/*`
- Booking operations: `/api/bookings/*`
- Payment processing: `/api/payments/*`
- Chat messaging: WebSocket `/ws`
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
- WebSocket authentication via user ID verification
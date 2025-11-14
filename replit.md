# fliQ - Geolocation-Based Companion Booking Platform

## Overview
fliQ is a real-time, geolocation-based web application connecting clients with verified professional companions via an interactive map. Inspired by Uber, it features secure payment processing, real-time messaging, and multi-role dashboards for clients, companions, and administrators. The platform aims to provide a safe, efficient, and transparent companion booking experience.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
**Technology Stack:** React with TypeScript, Wouter for routing, TanStack Query for state management, TailwindCSS with a custom design system, Radix UI and shadcn/ui for components, and Lucide React for icons.
**Design System:** Map-first, mobile-responsive design, Inter and Poppins fonts, a custom HSL-based color system, and Tailwind-based spacing and elevation.
**Key Pages:** Landing page with map/list view, detailed companion profiles, client and companion dashboards, real-time booking chat, and an admin dashboard.
**UI/UX Decisions:** Implemented PWA functionality with a branded splash screen and offline support. Responsive grid layouts for dashboards (1 column mobile, 2 tablet, 3 desktop), mobile-first design for booking cards and companion galleries, and UI improvements like side drawers for profile editing. Dark mode theme with persistence. Favorites feature with heart icon toggle on companion profiles (client-only access) and dedicated Favorites page (`/favorites`) where clients can view all their favorited companions in a grid layout. Favorites stat card in ClientDashboard is clickable for quick navigation. Public reviews display on companion profiles with privacy-preserving name sanitization and robust date handling. BookingChat page features tabbed interface (Details and Review tabs) showing booking information and mutual ratings/reviews when available.

### Backend
**Technology Stack:** Node.js with Express.js and TypeScript.
**Authentication:** Session-based authentication with HTTP-only cookies and role-based access control. `trust proxy` setting for production.
**Real-time Communication:** Native WebSocket server for secure, authenticated real-time chat messaging with production-ready connection stability. Features exponential backoff retry logic (1-16s delays, max 5 attempts), comprehensive diagnostic logging for session validation failures, connection state tracking (connecting/connected/failed/max_retries_reached), memoized message callbacks to prevent unnecessary reconnections, unmount protection to prevent retry loops, and manual retry UI for failed connections.
**API Endpoints:** Organized RESTful API for authentication, companion management, booking operations, payment processing, chat messaging, favorites management (including `GET /api/favorites/companions` for enriched companion details), and admin functions.
**Feature Specifications:** Implemented a robust booking workflow including request, acceptance, payment, chat, completion request, client confirmation (with 48-hour auto-completion), and dispute system. Critical payment workflow fixes ensuring proper booking display and payment redirection. Password recovery system with email-based token reset (1-hour expiration) via Resend integration.
**Dashboard Stats:** Client dashboard displays real-time metrics calculated from database: Total Spent (sum of completed booking amounts), Active Bookings count, Favorites count, and Average Rating (from ratings given by client). Companion dashboard shows accurate earnings, booking counts, and performance metrics.
**Booking Data Enrichment:** Both `getClientBookings` and `getCompanionBookings` now join with user/companion tables to return enriched booking objects including companionName and clientName for proper display in rating modals and UI components.

### Data Storage
**Database:** Neon Serverless PostgreSQL, managed with Drizzle ORM for type-safe queries and schema migrations.
**Schema Design:** Core tables include `users`, `companions`, `bookings`, `payments`, `messages`, `ratings`, `user_favorites`, `admin_settings`, and `admin_logs`. Includes high-precision geolocation data.
**Moderation System:** Integrates a moderation system for companion profiles and content (pending, approved, rejected statuses).
**Favorites System:** Implements user favorites with a dedicated `user_favorites` table featuring a unique constraint on (userId, companionId) to prevent duplicates.

## External Dependencies
**Payment Integration:** Paystack for secure payment processing, split payments, bank account verification, and webhooks.
**AI Content Moderation:** OpenAI's Moderation API for text and GPT-5 Vision API for image analysis.
**Frontend Assets:** Google Fonts (Inter, Poppins).
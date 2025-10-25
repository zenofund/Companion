# fliQ - Geolocation-Based Companion Booking Platform

## Overview

fliQ is a real-time, geolocation-based web application designed to connect clients with verified professional companions through an interactive map interface. Inspired by Uber, it offers secure payment processing, real-time messaging, and multi-role dashboards for clients, companions, and administrators. The platform aims to revolutionize companion booking by providing a safe, efficient, and transparent service.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**October 25, 2025 - Booking Payment Fix & Simple Calendar**
- Redesigned booking modal with simple native HTML5 date and time inputs
- Uses device's built-in calendar picker for clean, reliable date selection
- Fixed backend validation to use custom Zod schema that transforms ISO date strings to Date objects
- Separated date and time fields with proper form validation for both
- Fixed Paystack payment flow - now properly creates booking and redirects to payment
- Backend correctly handles ISO string dates from frontend and converts them for database

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
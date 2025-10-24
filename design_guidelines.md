# fliQ Design Guidelines

## Design Approach

**Reference-Based Design**: Drawing primary inspiration from Uber's clean, map-centric interface with influence from Airbnb's profile cards and Tinder's card-based browsing for the companion discovery experience.

**Key Design Principles**:
- Map-first interface prioritizing geolocation
- Clean, trustworthy aesthetic for safety-critical platform
- High contrast for outdoor/mobile readability
- Smooth transitions between list and map views
- Premium feel balancing accessibility with elegance

---

## Typography

**Font Families** (Google Fonts):
- **Primary**: Inter (UI, body text, data)
- **Accent**: Poppins (headings, companion names, CTAs)

**Type Scale**:
- Hero/Display: Poppins 48px/56px, weight 700
- Section Headers: Poppins 32px/40px, weight 600
- Card Titles/Names: Poppins 24px/32px, weight 600
- Body: Inter 16px/24px, weight 400
- Captions/Meta: Inter 14px/20px, weight 500
- Buttons: Inter 16px/20px, weight 600, uppercase tracking

---

## Layout System

**Spacing Primitives**: Consistent use of Tailwind units: 2, 4, 8, 12, 16, 24
- Micro spacing (icons, badges): 2
- Component padding: 4, 8
- Card spacing: 12, 16
- Section spacing: 24

**Grid Structure**:
- Container max-width: 1440px
- Map view: Full viewport height minus header (map takes 100% width)
- List view: 3-column grid on desktop (lg:grid-cols-3), 2 on tablet (md:grid-cols-2), 1 on mobile
- Dashboard cards: 4-column metrics grid, 2-column content areas

---

## Core Components

### Header/Navigation
- Fixed position, translucent background with backdrop blur
- Logo (fliQ) left-aligned, 40px height
- Right-aligned: Toggle view button (Map/List), Profile avatar, Notifications badge
- Mobile: Hamburger menu, bottom navigation for key actions

### Map Interface
- Full-height map canvas using Mapbox/Google Maps
- Companion pins: Custom markers with avatar thumbnails, pulsing animation for "available now"
- Info cards: Compact overlay cards on pin click showing: Avatar (80px), Name, Rate, Distance, Quick Book CTA
- Floating controls: Top-right corner - View toggle, Filter button, Current location button (all 48px touch targets)

### Companion Cards (List View)
- Card dimensions: 380px width, auto height
- Layout structure:
  - Hero image (380x280px, rounded-t-2xl) with availability badge overlay (top-right)
  - Content section (p-6):
    - Avatar (64px circle, -mt-8 overlapping image)
    - Name (Poppins 20px) + Verification badge
    - Stats row: Rate/hr | Distance | Age (Lucide icons, 14px Inter)
    - Services tags (pill badges, max 3 visible)
    - "View Profile" button (full-width, subtle)
  - Hover: Subtle lift (shadow-lg), image zoom 1.05x

### Profile Page
- Hero section (500px height):
  - Full-width background (blurred companion image)
  - Centered profile card overlay (max-w-4xl):
    - Large avatar (160px circle)
    - Name + verification badge
    - Quick stats grid (4 columns): Rate, City, Age, Distance
- Content sections (max-w-4xl centered):
  - About/Services (2-column: icon tabs left, content right)
  - Languages & Interests (chip badges in flowing grid)
  - Gallery (3-column masonry grid, lightbox on click)
  - "Book Now" button (sticky bottom bar on mobile, fixed position on desktop)

### Booking Modal
- Centered modal (max-w-2xl), backdrop blur
- Header: "Book [Companion Name]" + close button
- Form sections (vertical stack, spacing-6):
  - Date/Time picker (large, calendar visual)
  - Duration slider with hour input
  - Meeting location (map input with autocomplete)
  - Special requests (textarea, 3 rows)
  - Price summary card (highlighted, shows calculation)
  - Primary CTA: "Proceed to Payment" (full-width, 56px height)

### Dashboards

**Client Dashboard**:
- Top metrics row: 4 stat cards (Active Bookings, Total Spent, Favorites, Loyalty Points)
- Navigation tabs: Search | My Bookings | Messages | Support
- Main content area:
  - Active bookings: Timeline cards with countdown, chat button
  - Booking history: Table view with filters, ratings
  - Quick actions sidebar: Search again, Favorites, Refer friend

**Companion Dashboard**:
- Hero metrics: 6 KPI cards (Current Bookings, Today's Earnings, Response Rate, Average Rating, Total Hours, Acceptance Rate)
- Toggle availability: Large, prominent switch with online/offline states
- Request inbox: Card-based with 15-min countdown timer, Accept/Decline actions
- Earnings chart: Line graph showing weekly/monthly trends
- Profile completion indicator: Progress ring with action items

**Admin Dashboard**:
- Overview grid: 8 metric cards (Users, Active Bookings, Revenue, Flagged Content, Pending Approvals, etc.)
- Management sections:
  - User moderation table: Search, filter, ban actions
  - Content review queue: Grid of flagged images/profiles with approve/reject
  - Split configuration: Visual slider showing platform/companion percentage
  - System notifications: Message composer with template selection

### Chat Interface
- Sidebar layout: Conversation list (320px) + active chat
- Messages: Bubble design, timestamp on hover, read receipts
- Input area: Text field + attachment button, "Available until [time]" indicator
- Locked state: Overlay with "Booking completed" message, archive download option

---

## Animations

**Minimal, purposeful motion**:
- Card hovers: Transform translateY(-4px), duration 200ms
- Modal entry: Fade + scale from 0.95, duration 300ms
- Map markers: Pulse animation (scale 1→1.1) every 2s for available companions
- Loading states: Skeleton screens, no spinners
- Page transitions: Crossfade, 150ms

---

## Images

### Hero Images
- **Landing page**: Large hero (80vh) showing diverse group enjoying city nightlife, overlaid with translucent gradient and "Find Your Perfect Companion" headline, blurred-background CTAs
- **Companion profiles**: Portrait-oriented lifestyle photos (avoid headshots), showing personality and setting
- **Dashboard headers**: Subtle background patterns or city skylines (low opacity)

### Gallery Images
- Companion profiles: 6 lifestyle photos minimum
- Lightbox: Full-screen modal with navigation arrows, counter (1/6)
- Image requirements: Minimum 1200x800px, professional quality

---

## Accessibility

- Touch targets: Minimum 48x48px
- Form inputs: Clear labels, error states with icons
- Color contrast: WCAG AA compliant throughout
- Focus indicators: 2px blue ring on all interactive elements
- Screen reader: Proper ARIA labels on map markers, icons
- Keyboard navigation: Tab order follows visual hierarchy

---

## Distinctive Elements

**Trust & Safety Signals**:
- Verification badges: Blue checkmark icon next to verified companions
- Moderation notices: Yellow warning banner for "Pending Review" profiles
- Safety tips: Collapsible info cards in booking flow

**Premium Touches**:
- Gradient accents on CTAs and badges
- Subtle glass-morphism on overlays (backdrop-blur-md)
- Micro-interactions: Success animations on booking confirmation
- Rating stars: Filled/half-filled icons with numeric score

**Mobile-First Optimizations**:
- Bottom sheet modals for mobile booking flow
- Sticky "Book Now" button on profile pages
- Swipeable companion cards in list view
- Floating action button for quick search/filter access
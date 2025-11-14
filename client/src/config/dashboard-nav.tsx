import {
  Home,
  Search,
  Calendar,
  MessageCircle,
  Heart,
  Settings,
  Shield,
  AlertTriangle,
  Activity,
  CheckCircle,
  Clock,
} from "lucide-react";
import { NavItem } from "@/components/layout/DashboardLayout";

export const clientNavItems: NavItem[] = [
  {
    value: "browse",
    label: "Browse Companions",
    icon: Search,
  },
  {
    value: "bookings",
    label: "My Bookings",
    icon: Calendar,
  },
  {
    value: "messages",
    label: "Messages",
    icon: MessageCircle,
  },
  {
    value: "favorites",
    label: "Favorites",
    icon: Heart,
  },
];

export const companionNavItems: NavItem[] = [
  {
    value: "overview",
    label: "Overview",
    icon: Home,
  },
  {
    value: "requests",
    label: "Booking Requests",
    icon: Clock,
  },
  {
    value: "active",
    label: "Active Bookings",
    icon: CheckCircle,
  },
  {
    value: "history",
    label: "Booking History",
    icon: Calendar,
  },
];

export const adminNavItems: NavItem[] = [
  {
    value: "moderation",
    label: "Companion Moderation",
    icon: Shield,
  },
  {
    value: "bookings",
    label: "Disputes",
    icon: AlertTriangle,
  },
  {
    value: "settings",
    label: "Platform Settings",
    icon: Settings,
  },
  {
    value: "logs",
    label: "Activity Logs",
    icon: Activity,
  },
];

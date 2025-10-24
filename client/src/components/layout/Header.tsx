import { Link, useLocation } from "wouter";
import { MapPin, List, Bell, Menu, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  user?: {
    id: string;
    name?: string;
    avatar?: string;
    role: string;
  } | null;
  viewMode?: "map" | "list";
  onViewModeChange?: (mode: "map" | "list") => void;
  notificationCount?: number;
}

export function Header({ user, viewMode, onViewModeChange, notificationCount = 0 }: HeaderProps) {
  const [location] = useLocation();
  const isHomePage = location === "/";

  return (
    <header 
      className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md"
      data-testid="header-navigation"
    >
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2" data-testid="link-home">
            <img 
              src="/attached_assets/fliQ_logo_1761347377488.png" 
              alt="fliQ" 
              className="h-10"
            />
          </Link>

          {/* Center - View Toggle (only on home page) */}
          {isHomePage && onViewModeChange && (
            <div className="hidden md:flex items-center gap-2 bg-muted rounded-md p-1">
              <Button
                variant={viewMode === "map" ? "default" : "ghost"}
                size="sm"
                onClick={() => onViewModeChange("map")}
                data-testid="button-view-map"
                className="gap-2"
              >
                <MapPin className="h-4 w-4" />
                Map
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => onViewModeChange("list")}
                data-testid="button-view-list"
                className="gap-2"
              >
                <List className="h-4 w-4" />
                List
              </Button>
            </div>
          )}

          {/* Right Side - User Actions */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                {/* Notifications */}
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="relative"
                  data-testid="button-notifications"
                >
                  <Bell className="h-5 w-5" />
                  {notificationCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {notificationCount > 9 ? "9+" : notificationCount}
                    </Badge>
                  )}
                </Button>

                {/* User Menu */}
                <Avatar 
                  className="h-9 w-9 hover-elevate cursor-pointer border-2 border-primary/20"
                  onClick={() => window.location.href = `/dashboard/${user.role}`}
                  data-testid="link-dashboard"
                >
                  <AvatarImage src={user.avatar} alt={user.name || "User"} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {user.name?.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" data-testid="button-login">
                    Log In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="default" data-testid="button-register">
                    Sign Up
                  </Button>
                </Link>
              </>
            )}

            {/* Mobile Menu */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden"
              data-testid="button-menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

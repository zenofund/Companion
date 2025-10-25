import { Link, useLocation } from "wouter";
import { MapPin, List, Bell, Menu, User, LogOut, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  onProfileClick?: () => void;
}

export function Header({ user, viewMode, onViewModeChange, notificationCount = 0, onProfileClick }: HeaderProps) {
  const [location, setLocation] = useLocation();
  const isHomePage = location === "/";
  const { toast } = useToast();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.clear();
      setLocation("/");
      toast({
        title: "Logged out successfully",
        description: "You have been logged out of your account",
      });
    },
    onError: () => {
      toast({
        title: "Logout failed",
        description: "An error occurred while logging out",
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

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
              src="/logo.png" 
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Avatar 
                      className="h-9 w-9 hover-elevate cursor-pointer border-2 border-primary/20"
                      data-testid="button-user-menu"
                    >
                      <AvatarImage src={user.avatar} alt={user.name || "User"} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {user.name?.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.name || "User"}</p>
                        <p className="text-xs leading-none text-muted-foreground capitalize">{user.role}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link 
                        href={`/dashboard/${user.role}`}
                        className="cursor-pointer"
                        data-testid="link-dashboard"
                      >
                        <UserCircle className="mr-2 h-4 w-4" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    {onProfileClick && (
                      <DropdownMenuItem 
                        onClick={onProfileClick}
                        data-testid="button-profile"
                      >
                        <User className="mr-2 h-4 w-4" />
                        Profile
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={handleLogout}
                      disabled={logoutMutation.isPending}
                      data-testid="button-logout"
                      className="text-destructive focus:text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      {logoutMutation.isPending ? "Logging out..." : "Logout"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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

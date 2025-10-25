import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Banknote, Heart, Star, MessageCircle, Clock, Search, Map, List } from "lucide-react";
import { format } from "date-fns";
import { CompanionCard } from "@/components/companion/CompanionCard";
import { MapView } from "@/components/map/MapView";

export default function ClientDashboard() {
  const [browseViewMode, setBrowseViewMode] = useState<"list" | "map">("list");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: user } = useQuery({ queryKey: ["/api/auth/me"] });
  const { data: bookings } = useQuery({ queryKey: ["/api/bookings/client"] });
  const { data: stats } = useQuery({ queryKey: ["/api/stats/client"] });

  const activeBookings = bookings?.filter((b: any) => b.status === "active") || [];
  const completedBookings = bookings?.filter((b: any) => b.status === "completed") || [];

  // Get user's geolocation for browse tab
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location:", error);
          // Default to Lagos, Nigeria if geolocation fails
          setUserLocation({ lat: 6.5244, lng: 3.3792 });
        }
      );
    }
  }, []);

  // Fetch companions for browse tab
  const { data: companions, isLoading: companionsLoading } = useQuery({
    queryKey: ["/api/companions", userLocation?.lat, userLocation?.lng],
    queryFn: async () => {
      if (!userLocation) return [];
      const params = new URLSearchParams({
        lat: userLocation.lat.toString(),
        lng: userLocation.lng.toString(),
      });
      const response = await fetch(`/api/companions?${params}`);
      if (!response.ok) throw new Error("Failed to fetch companions");
      return response.json();
    },
    enabled: !!userLocation,
  });

  // Calculate distance between two points
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Filter and sort companions by distance
  const filteredCompanions = companions
    ?.filter((c: any) => c.moderationStatus === "approved")
    .filter((c: any) => {
      if (!searchQuery) return true;
      return (
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.services?.some((s: string) => s.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    })
    .map((c: any) => {
      const distance = userLocation && c.latitude && c.longitude
        ? calculateDistance(
            userLocation.lat,
            userLocation.lng,
            parseFloat(c.latitude),
            parseFloat(c.longitude)
          )
        : undefined;
      return { ...c, distance };
    })
    .sort((a: any, b: any) => (a.distance || 999) - (b.distance || 999));

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />
      
      <main className="pt-28 container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold mb-2" data-testid="text-welcome">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-muted-foreground">
            Manage your bookings and explore new companions
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Bookings</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-active-bookings">
                {stats?.activeBookings || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-spent">
                ₦{stats?.totalSpent || "0.00"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Favorites</CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-favorites">
                {stats?.favorites || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Rating Given</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-avg-rating">
                {stats?.averageRating || "0.0"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="browse" className="w-full">
          <TabsList>
            <TabsTrigger value="browse" data-testid="tab-browse">
              Browse Companions
            </TabsTrigger>
            <TabsTrigger value="bookings" data-testid="tab-bookings">
              My Bookings
            </TabsTrigger>
            <TabsTrigger value="messages" data-testid="tab-messages">
              Messages
            </TabsTrigger>
            <TabsTrigger value="favorites" data-testid="tab-favorites">
              Favorites
            </TabsTrigger>
          </TabsList>

          {/* Browse Companions Tab */}
          <TabsContent value="browse" className="mt-6">
            <Card>
              <CardContent className="p-6">
                {/* Search and View Toggle */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, city, or service..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-companions"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={browseViewMode === "list" ? "default" : "outline"}
                      size="icon"
                      onClick={() => setBrowseViewMode("list")}
                      data-testid="button-list-view"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={browseViewMode === "map" ? "default" : "outline"}
                      size="icon"
                      onClick={() => setBrowseViewMode("map")}
                      data-testid="button-map-view"
                    >
                      <Map className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Companions Display */}
                {browseViewMode === "list" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {companionsLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <div 
                          key={i} 
                          className="h-[400px] rounded-lg bg-muted animate-pulse"
                          data-testid="skeleton-companion-card"
                        />
                      ))
                    ) : filteredCompanions && filteredCompanions.length > 0 ? (
                      filteredCompanions.map((companion: any) => (
                        <CompanionCard
                          key={companion.id}
                          companion={companion}
                          distance={companion.distance}
                        />
                      ))
                    ) : (
                      <div className="col-span-full text-center py-12">
                        <p className="text-muted-foreground text-lg" data-testid="text-no-companions">
                          No companions found in your area
                        </p>
                      </div>
                    )}
                  </div>
                ) : userLocation ? (
                  <div className="h-[600px]" data-testid="map-container">
                    <MapView
                      companions={filteredCompanions || []}
                      userLocation={userLocation}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[600px]">
                    <p className="text-muted-foreground">Loading map...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bookings" className="mt-6">
            <div className="space-y-4">
              {activeBookings.length > 0 ? (
                activeBookings.map((booking: any) => (
                  <Card key={booking.id} data-testid={`booking-card-${booking.id}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <h3 className="font-heading text-lg font-semibold">
                            {booking.companionName}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(booking.bookingDate), "PPP")}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {booking.hours} hours
                            </div>
                            <div className="flex items-center gap-1">
                              <Banknote className="h-4 w-4" />
                              ₦{booking.totalAmount}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="default">
                            {booking.status}
                          </Badge>
                          <Button size="sm" variant="outline" data-testid={`button-chat-${booking.id}`}>
                            <MessageCircle className="h-4 w-4 mr-2" />
                            Chat
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <p className="text-muted-foreground" data-testid="text-no-bookings">
                      No active bookings. Start exploring companions!
                    </p>
                    <Button className="mt-4" onClick={() => window.location.href = "/"}>
                      Browse Companions
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="messages" className="mt-6">
            <Card>
              <CardContent className="p-12 text-center">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground" data-testid="text-no-messages">
                  No messages yet
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="favorites" className="mt-6">
            <Card>
              <CardContent className="p-12 text-center">
                <Heart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground" data-testid="text-no-favorites">
                  No favorites yet
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

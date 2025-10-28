import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Banknote, Heart, Star, MessageCircle, Clock, Search, Map, List, CheckCircle, AlertCircle, MapPin } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { CompanionCard } from "@/components/companion/CompanionCard";
import { MapView } from "@/components/map/MapView";
import { useToast } from "@/hooks/use-toast";
import { RatingModal } from "@/components/booking/RatingModal";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function ClientDashboard() {
  const [browseViewMode, setBrowseViewMode] = useState<"list" | "map">("list");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: user } = useQuery<any>({ queryKey: ["/api/auth/me"] });
  const { data: bookings } = useQuery<any[]>({ queryKey: ["/api/bookings/client"] });
  const { data: pendingCompletionBookings } = useQuery<any[]>({ queryKey: ["/api/bookings/client/pending-completion"] });
  const { data: stats } = useQuery<any>({ queryKey: ["/api/stats/client"] });
  
  // Fetch rating for selected booking when modal opens
  const { data: existingRating } = useQuery<any>({
    queryKey: ["/api/ratings", selectedBooking?.id],
    enabled: !!selectedBooking && ratingModalOpen,
  });

  const pendingPaymentBookings = bookings?.filter((b: any) => b.status === "accepted") || [];
  const activeBookings = bookings?.filter((b: any) => b.status === "active") || [];
  const completedBookings = bookings?.filter((b: any) => b.status === "completed") || [];

  // Check for payment status on component mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");

    if (paymentStatus === "success") {
      toast({
        title: "Payment successful!",
        description: "Your booking has been confirmed. The companion will be notified.",
      });
      // Clear the query parameter
      setLocation("/dashboard/client");
    } else if (paymentStatus === "failed") {
      toast({
        title: "Payment failed",
        description: "Your payment could not be processed. Please try again.",
        variant: "destructive",
      });
      setLocation("/dashboard/client");
    } else if (paymentStatus === "error") {
      toast({
        title: "Payment error",
        description: "An error occurred while processing your payment.",
        variant: "destructive",
      });
      setLocation("/dashboard/client");
    }
  }, [toast, setLocation]);

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
    .filter((c: any) => c.distance === undefined || c.distance <= 50)
    .sort((a: any, b: any) => (a.distance || 999) - (b.distance || 999));

  // Confirm completion mutation
  const confirmCompletionMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      return await apiRequest("POST", `/api/bookings/${bookingId}/confirm-completion`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/client"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/client/pending-completion"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/client"] });
      toast({
        title: "Booking confirmed",
        description: "The booking has been marked as completed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to confirm completion",
        variant: "destructive",
      });
    },
  });

  // Dispute mutation
  const disputeMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      return await apiRequest("POST", `/api/bookings/${bookingId}/dispute`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/client"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/client/pending-completion"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/client"] });
      toast({
        title: "Dispute opened",
        description: "The booking has been marked as disputed. Our team will review it shortly.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to open dispute",
        variant: "destructive",
      });
    },
  });

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
            {/* Pending Payment Bookings */}
            {pendingPaymentBookings && pendingPaymentBookings.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-500" />
                  <h3 className="font-heading text-xl font-semibold">Pending Payment</h3>
                </div>
                <div className="space-y-4">
                  {pendingPaymentBookings.map((booking: any) => {
                    const expiresAt = booking.requestExpiresAt ? new Date(booking.requestExpiresAt) : null;
                    const timeLeft = expiresAt 
                      ? formatDistanceToNow(expiresAt, { addSuffix: true })
                      : null;
                    
                    return (
                      <Card key={booking.id} className="border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30" data-testid={`pending-payment-${booking.id}`}>
                        <CardContent className="p-4 md:p-6">
                          <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <h3 className="font-heading text-lg font-semibold">
                                {booking.companionName}
                              </h3>
                              <Badge variant="secondary" className="bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 w-fit">
                                Payment Required
                              </Badge>
                            </div>
                            
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="font-medium">{format(new Date(booking.bookingDate), "PPP")}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="font-medium">{booking.hours} hours</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Banknote className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="font-medium">₦{booking.totalAmount}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="font-medium">{booking.meetingLocation}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-sm bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200 px-3 py-2 rounded-md">
                              <AlertCircle className="h-4 w-4 flex-shrink-0" />
                              <span>Complete payment to confirm your booking</span>
                            </div>

                            <Button
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={async () => {
                                try {
                                  const response = await fetch(`/api/bookings/${booking.id}/payment-url`);
                                  if (!response.ok) throw new Error("Failed to get payment URL");
                                  const data = await response.json();
                                  window.location.href = data.paymentUrl;
                                } catch (error) {
                                  toast({
                                    title: "Error",
                                    description: "Failed to get payment link. Please try again.",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              data-testid={`button-pay-now-${booking.id}`}
                            >
                              <Banknote className="h-4 w-4 mr-2" />
                              Pay Now
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Active Bookings */}
            <div className="space-y-4">
              {activeBookings.length > 0 ? (
                activeBookings.map((booking: any) => (
                  <Card key={booking.id} data-testid={`booking-card-${booking.id}`}>
                    <CardContent className="p-4 md:p-6">
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <h3 className="font-heading text-lg font-semibold">
                            {booking.companionName}
                          </h3>
                          <Badge variant="default" className="w-fit">
                            {booking.status}
                          </Badge>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium">{format(new Date(booking.bookingDate), "PPP")}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium">{booking.hours} hours</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Banknote className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium">₦{booking.totalAmount}</span>
                          </div>
                        </div>

                        <Button 
                          size="sm" 
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => setLocation(`/booking/${booking.id}/chat`)}
                          data-testid={`button-chat-${booking.id}`}
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Chat
                        </Button>
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

            {/* Pending Completion Bookings */}
            {pendingCompletionBookings && pendingCompletionBookings.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                  <h3 className="font-heading text-xl font-semibold">Awaiting Your Confirmation</h3>
                </div>
                <div className="space-y-4">
                  {pendingCompletionBookings.map((booking: any) => {
                    const completionRequestedAt = booking.completionRequestedAt ? new Date(booking.completionRequestedAt) : null;
                    const hoursRemaining = completionRequestedAt 
                      ? Math.max(0, 48 - Math.floor((Date.now() - completionRequestedAt.getTime()) / (1000 * 60 * 60)))
                      : 0;
                    
                    return (
                      <Card key={booking.id} className="border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/30" data-testid={`pending-completion-${booking.id}`}>
                        <CardContent className="p-4 md:p-6">
                          <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <h3 className="font-heading text-lg font-semibold">
                                {booking.companionName}
                              </h3>
                              <Badge variant="secondary" className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 w-fit">
                                Pending Confirmation
                              </Badge>
                            </div>
                            
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="font-medium">{format(new Date(booking.bookingDate), "PPP")}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="font-medium">{booking.hours} hours</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Banknote className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="font-medium">₦{booking.totalAmount}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="font-medium">{booking.meetingLocation}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-sm bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 px-3 py-2 rounded-md">
                              <Clock className="h-4 w-4 flex-shrink-0" />
                              <span>
                                {hoursRemaining > 0 
                                  ? `Auto-completes in ${hoursRemaining} hours if not confirmed`
                                  : "Will auto-complete soon"}
                              </span>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full sm:w-auto"
                                onClick={() => disputeMutation.mutate(booking.id)}
                                disabled={disputeMutation.isPending}
                                data-testid={`button-dispute-${booking.id}`}
                              >
                                <AlertCircle className="h-4 w-4 mr-2" />
                                {disputeMutation.isPending ? "Disputing..." : "Dispute"}
                              </Button>
                              <Button
                                size="sm"
                                className="w-full sm:w-auto"
                                onClick={() => confirmCompletionMutation.mutate(booking.id)}
                                disabled={confirmCompletionMutation.isPending}
                                data-testid={`button-confirm-${booking.id}`}
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                {confirmCompletionMutation.isPending ? "Confirming..." : "Confirm"}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Completed Bookings */}
            {completedBookings.length > 0 && (
              <div className="mt-8">
                <h3 className="font-heading text-xl font-semibold mb-4">Booking History</h3>
                <div className="space-y-4">
                  {completedBookings.map((booking: any) => (
                    <Card key={booking.id} data-testid={`completed-booking-${booking.id}`}>
                      <CardContent className="p-4 md:p-6">
                        <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <h3 className="font-heading text-lg font-semibold">
                              {booking.companionName}
                            </h3>
                            <Badge variant="secondary" className="w-fit">Completed</Badge>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium">{format(new Date(booking.bookingDate), "PPP")}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium">{booking.hours} hours</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Banknote className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium">₦{booking.totalAmount}</span>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => {
                              setSelectedBooking(booking);
                              setRatingModalOpen(true);
                            }}
                            data-testid={`button-rate-${booking.id}`}
                          >
                            <Star className="h-4 w-4 mr-2" />
                            Rate
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
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

      {/* Rating Modal */}
      {selectedBooking && (
        <RatingModal
          open={ratingModalOpen}
          onOpenChange={setRatingModalOpen}
          bookingId={selectedBooking.id}
          companionName={selectedBooking.companionName}
          userRole="client"
          existingRating={
            existingRating?.clientRating
              ? {
                  rating: existingRating.clientRating,
                  review: existingRating.clientReview,
                }
              : null
          }
        />
      )}
    </div>
  );
}

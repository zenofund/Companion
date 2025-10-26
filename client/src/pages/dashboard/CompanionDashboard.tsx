import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Header } from "@/components/layout/Header";
import { EditProfileSheet } from "@/components/companion/EditProfileSheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Banknote, 
  Calendar, 
  Star, 
  Clock, 
  TrendingUp, 
  CheckCircle,
  XCircle,
  MessageCircle 
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Companion } from "@shared/schema";

interface CompanionStats {
  activeBookings: number;
  todayEarnings: string;
  responseRate: string;
  averageRating: string;
  totalHours: number;
  acceptanceRate: string;
}

interface PendingBooking {
  id: string;
  clientName: string;
  bookingDate: string;
  hours: number;
  totalAmount: string;
  meetingLocation: string;
  specialRequests?: string;
  requestExpiresAt: string;
}

export default function CompanionDashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const { data: user } = useQuery<any>({ queryKey: ["/api/auth/me"] });
  const { data: profile} = useQuery<Companion | null>({ queryKey: ["/api/companion/profile"] });
  const { data: pendingRequests } = useQuery<PendingBooking[]>({ queryKey: ["/api/bookings/pending"] });
  const { data: activeBookings } = useQuery<any[]>({ queryKey: ["/api/bookings/companion/active"] });
  const { data: stats } = useQuery<CompanionStats>({ queryKey: ["/api/stats/companion"] });

  const toggleAvailabilityMutation = useMutation({
    mutationFn: async (isAvailable: boolean) => {
      return await apiRequest("PATCH", "/api/companion/availability", { isAvailable });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/companion/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/companion"] });
      toast({
        title: "Availability updated",
        description: variables ? "You are now available" : "You are now offline",
      });
    },
  });

  const handleBookingAction = useMutation({
    mutationFn: async ({ bookingId, action }: { bookingId: string; action: "accept" | "reject" }) => {
      return await apiRequest("POST", `/api/bookings/${bookingId}/${action}`, {});
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/companion/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/companion"] });
      toast({
        title: "Booking updated",
        description: variables.action === "accept" 
          ? "Booking accepted successfully" 
          : "Booking declined",
      });
    },
  });

  const completeBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      return await apiRequest("POST", `/api/bookings/${bookingId}/complete`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/companion/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/companion"] });
      toast({
        title: "Booking completed",
        description: "The booking has been marked as completed",
      });
    },
  });


  const calculateTimeRemaining = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    const minutes = Math.floor(diff / 60000);
    return minutes > 0 ? `${minutes}m remaining` : "Expired";
  };

  // Calculate profile completion based on filled fields (onboarding requirements)
  const profileCompletion = useMemo(() => {
    if (!profile) return 0;
    
    let completed = 0;
    const totalFields = 10;
    
    if (profile.bio) completed++;
    if (profile.city) completed++;
    if (profile.hourlyRate && parseFloat(profile.hourlyRate) > 0) completed++;
    if (profile.services && profile.services.length > 0) completed++;
    if (profile.interests && profile.interests.length > 0) completed++;
    if (profile.languages && profile.languages.length > 0) completed++;
    if (profile.gallery && profile.gallery.length > 0) completed++;
    if (profile.bankAccountNumber) completed++;
    if (profile.paystackSubaccountCode) completed++; // Banking setup
    if (profile.moderationStatus === "approved") completed++; // Admin verification
    
    return Math.round((completed / totalFields) * 100);
  }, [profile]);

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} onProfileClick={() => setIsProfileModalOpen(true)} />
      
      <main className="pt-28 container mx-auto px-4 py-8">
        {/* Header with Availability Toggle */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold mb-2" data-testid="text-welcome">
              Welcome back, {user?.name}!
            </h1>
            <p className="text-muted-foreground">
              Manage your bookings and earnings
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Availability</p>
              <p className="font-semibold">
                {profile?.isAvailable ? "Online" : "Offline"}
              </p>
            </div>
            <Switch
              checked={profile?.isAvailable || false}
              onCheckedChange={(checked) => toggleAvailabilityMutation.mutate(checked)}
              data-testid="switch-availability"
            />
          </div>
        </div>

        {/* Profile Completion Alert */}
        {profileCompletion < 100 && (
          <Card className="mb-6 border-accent bg-accent/5">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">Complete Your Profile</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Complete your profile to attract more clients
                  </p>
                  <Progress value={profileCompletion} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">{profileCompletion}% complete</p>
                </div>
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={() => profile ? setIsProfileModalOpen(true) : setLocation("/onboarding/companion")}
                  data-testid="button-complete-profile"
                >
                  {profile ? "Edit Profile" : "Complete Profile"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
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
              <CardTitle className="text-sm font-medium">Today's Earnings</CardTitle>
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-today-earnings">
                ₦{stats?.todayEarnings || "0.00"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-response-rate">
                {stats?.responseRate || "0"}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-avg-rating">
                {stats?.averageRating || "0.0"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-hours">
                {stats?.totalHours || 0}h
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Acceptance Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-acceptance-rate">
                {stats?.acceptanceRate || "0"}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Requests */}
        <div className="mb-8">
          <h2 className="font-heading text-2xl font-semibold mb-4">Pending Requests</h2>
          <div className="space-y-4">
            {pendingRequests && pendingRequests.length > 0 ? (
              pendingRequests.map((request: any) => (
                <Card key={request.id} className="border-accent" data-testid={`request-card-${request.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-heading text-lg font-semibold">
                            {request.clientName}
                          </h3>
                          <Badge variant="outline" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {calculateTimeRemaining(request.requestExpiresAt)}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                          <div>
                            <p className="font-medium text-foreground">{format(new Date(request.bookingDate), "PPP")}</p>
                            <p className="text-xs">Date</p>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{request.hours} hours</p>
                            <p className="text-xs">Duration</p>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">₦{request.totalAmount}</p>
                            <p className="text-xs">Amount</p>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{request.meetingLocation}</p>
                            <p className="text-xs">Location</p>
                          </div>
                        </div>
                        {request.specialRequests && (
                          <p className="mt-3 text-sm text-muted-foreground">
                            <span className="font-medium">Note:</span> {request.specialRequests}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleBookingAction.mutate({ bookingId: request.id, action: "accept" })}
                          data-testid={`button-accept-${request.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Accept
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleBookingAction.mutate({ bookingId: request.id, action: "reject" })}
                          data-testid={`button-reject-${request.id}`}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Decline
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground" data-testid="text-no-requests">
                    No pending requests
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Active Bookings */}
        <div className="mb-8">
          <h2 className="font-heading text-2xl font-semibold mb-4">Active Bookings</h2>
          <div className="space-y-4">
            {activeBookings && activeBookings.length > 0 ? (
              activeBookings.map((booking: any) => (
                <Card key={booking.id} className="border-primary/20" data-testid={`active-booking-${booking.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-heading text-lg font-semibold">
                            {booking.clientName}
                          </h3>
                          <Badge variant="default" className="text-xs">
                            {booking.status === "accepted" ? "Upcoming" : "In Progress"}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                          <div>
                            <p className="font-medium text-foreground">{format(new Date(booking.bookingDate), "PPP")}</p>
                            <p className="text-xs">Date</p>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{booking.hours} hours</p>
                            <p className="text-xs">Duration</p>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">₦{booking.totalAmount}</p>
                            <p className="text-xs">Amount</p>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{booking.meetingLocation}</p>
                            <p className="text-xs">Location</p>
                          </div>
                        </div>
                        {booking.specialRequests && (
                          <p className="mt-3 text-sm text-muted-foreground">
                            <span className="font-medium">Note:</span> {booking.specialRequests}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation(`/chat/${booking.id}`)}
                          data-testid={`button-chat-${booking.id}`}
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Chat
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => completeBookingMutation.mutate(booking.id)}
                          disabled={completeBookingMutation.isPending}
                          data-testid={`button-complete-${booking.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {completeBookingMutation.isPending ? "Completing..." : "Complete"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground" data-testid="text-no-active-bookings">
                    No active bookings
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Profile Sheet */}
      <EditProfileSheet
        open={isProfileModalOpen}
        onOpenChange={setIsProfileModalOpen}
      />
    </div>
  );
}

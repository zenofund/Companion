import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Header } from "@/components/layout/Header";
import { EditProfileSheet } from "@/components/companion/EditProfileSheet";
import { RatingModal } from "@/components/booking/RatingModal";
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
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  
  const { data: user } = useQuery<any>({ queryKey: ["/api/auth/me"] });
  const { data: profile} = useQuery<Companion | null>({ queryKey: ["/api/companion/profile"] });
  const { data: pendingRequests } = useQuery<PendingBooking[]>({ queryKey: ["/api/bookings/pending"] });
  const { data: activeBookings } = useQuery<any[]>({ queryKey: ["/api/bookings/companion/active"] });
  const { data: completedBookings } = useQuery<any[]>({ queryKey: ["/api/bookings/companion/completed"] });
  const { data: stats } = useQuery<CompanionStats>({ queryKey: ["/api/stats/companion"] });
  
  // Separate active bookings into truly active and pending completion
  const reallyActiveBookings = activeBookings?.filter((b: any) => b.status === "accepted" || b.status === "active") || [];
  const pendingCompletionBookings = activeBookings?.filter((b: any) => b.status === "pending_completion") || [];
  
  // Fetch rating for selected booking when modal opens
  const { data: existingRating } = useQuery({
    queryKey: ["/api/ratings", selectedBooking?.id],
    enabled: !!selectedBooking && ratingModalOpen,
  });

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
        <div className="space-y-4 mb-8">
          <h1 className="font-heading text-3xl font-bold" data-testid="text-welcome">
            Welcome back, {user?.name}!
          </h1>
          
          <p className="text-muted-foreground">
            Manage your bookings and earnings
          </p>
          
          <div className="flex items-center gap-3 pt-2">
            <span className="text-sm font-medium">Availability:</span>
            <Switch
              checked={profile?.isAvailable || false}
              onCheckedChange={(checked) => toggleAvailabilityMutation.mutate(checked)}
              data-testid="switch-availability"
            />
            <span className="text-sm font-semibold">
              {profile?.isAvailable ? "Online" : "Offline"}
            </span>
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
          {pendingRequests && pendingRequests.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {pendingRequests.map((request: any) => (
                <Card key={request.id} className="border-accent" data-testid={`request-card-${request.id}`}>
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading text-lg font-semibold">
                          {request.clientName}
                        </h3>
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {calculateTimeRemaining(request.requestExpiresAt)}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
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
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">Note:</span> {request.specialRequests}
                        </p>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleBookingAction.mutate({ bookingId: request.id, action: "accept" })}
                          data-testid={`button-accept-${request.id}`}
                          className="flex-1"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Accept
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleBookingAction.mutate({ bookingId: request.id, action: "reject" })}
                          data-testid={`button-reject-${request.id}`}
                          className="flex-1"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Decline
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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

        {/* Active Bookings */}
        <div className="mb-8">
          <h2 className="font-heading text-2xl font-semibold mb-4">Active Bookings</h2>
          {reallyActiveBookings && reallyActiveBookings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {reallyActiveBookings.map((booking: any) => (
                <Card key={booking.id} className="border-primary/20" data-testid={`active-booking-${booking.id}`}>
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading text-lg font-semibold">
                          {booking.clientName}
                        </h3>
                        <Badge variant="default" className="text-xs">
                          {booking.status === "accepted" ? "Upcoming" : "In Progress"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
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
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">Note:</span> {booking.specialRequests}
                        </p>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation(`/booking/${booking.id}/chat`)}
                          data-testid={`button-chat-${booking.id}`}
                          className="flex-1"
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
                          className="flex-1"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {completeBookingMutation.isPending ? "Requesting..." : "Request Completion"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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

        {/* Pending Completion Bookings */}
        {pendingCompletionBookings && pendingCompletionBookings.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
              <h2 className="font-heading text-2xl font-semibold">Awaiting Client Confirmation</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {pendingCompletionBookings.map((booking: any) => {
                const completionRequestedAt = booking.completionRequestedAt ? new Date(booking.completionRequestedAt) : null;
                const hoursRemaining = completionRequestedAt 
                  ? Math.max(0, 48 - Math.floor((Date.now() - completionRequestedAt.getTime()) / (1000 * 60 * 60)))
                  : 0;
                
                return (
                  <Card key={booking.id} className="border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/30" data-testid={`pending-completion-${booking.id}`}>
                    <CardContent className="p-6">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                          <h3 className="font-heading text-lg font-semibold">
                            {booking.clientName}
                          </h3>
                          <Badge variant="secondary" className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs">
                            Pending
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
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
                        <div className="flex items-center gap-2 text-sm bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 px-3 py-2 rounded-md">
                          <Clock className="h-4 w-4" />
                          <span>
                            {hoursRemaining > 0 
                              ? `Auto-complete in ${hoursRemaining}h`
                              : "Auto-complete soon"}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setLocation(`/booking/${booking.id}/chat`)}
                          data-testid={`button-chat-pending-${booking.id}`}
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Chat
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Completed Bookings */}
        {completedBookings && completedBookings.length > 0 && (
          <div className="mb-8">
            <h2 className="font-heading text-2xl font-semibold mb-4">Booking History</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {completedBookings.map((booking: any) => (
                <Card key={booking.id} className="border-muted" data-testid={`completed-booking-${booking.id}`}>
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading text-lg font-semibold">
                          {booking.clientName}
                        </h3>
                        <Badge variant="secondary" className="text-xs">Completed</Badge>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedBooking(booking);
                          setRatingModalOpen(true);
                        }}
                        data-testid={`button-rate-${booking.id}`}
                      >
                        <Star className="h-4 w-4 mr-2" />
                        Rate Client
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Profile Sheet */}
      <EditProfileSheet
        open={isProfileModalOpen}
        onOpenChange={setIsProfileModalOpen}
      />

      {/* Rating Modal */}
      {selectedBooking && (
        <RatingModal
          open={ratingModalOpen}
          onOpenChange={setRatingModalOpen}
          bookingId={selectedBooking.id}
          clientName={selectedBooking.clientName}
          userRole="companion"
          existingRating={
            existingRating?.companionRating
              ? {
                  rating: existingRating.companionRating,
                  review: existingRating.companionReview,
                }
              : null
          }
        />
      )}
    </div>
  );
}

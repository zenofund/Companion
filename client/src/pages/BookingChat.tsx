import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Header } from "@/components/layout/Header";
import { Chat } from "@/components/chat/Chat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Calendar, MapPin, Clock, DollarSign } from "lucide-react";
import { format } from "date-fns";

interface Booking {
  id: string;
  clientId: string;
  companionId: string;
  bookingDate: string;
  hours: number;
  meetingLocation: string;
  specialRequests?: string;
  totalAmount: string;
  status: string;
  createdAt: string;
}

interface Companion {
  id: string;
  userId: string;
  city: string;
  hourlyRate: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export default function BookingChat() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const bookingId = params.id;

  const { data: user } = useQuery<any>({ queryKey: ["/api/auth/me"] });
  const { data: booking, isLoading } = useQuery<Booking>({
    queryKey: ["/api/bookings", bookingId],
    enabled: !!bookingId,
  });

  const { data: companion } = useQuery<any>({
    queryKey: ["/api/companions", booking?.companionId],
    enabled: !!booking?.companionId,
  });

  const { data: client } = useQuery<any>({
    queryKey: ["/api/users", booking?.clientId],
    enabled: !!booking?.clientId && user?.role === "companion",
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} />
        <div className="pt-16 container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-96">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} />
        <div className="pt-16 container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Booking not found</p>
              <Button
                onClick={() => setLocation(`/dashboard/${user?.role}`)}
                className="mt-4"
              >
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isClient = user?.id === booking.clientId;
  const otherUser = isClient ? companion : client;
  const otherUserName = isClient
    ? companion?.name || "Companion"
    : client?.name || "Client";

  const getStatusColor = (status: string) => {
    switch (status) {
      case "accepted":
        return "bg-green-500";
      case "pending":
        return "bg-yellow-500";
      case "active":
        return "bg-blue-500";
      case "completed":
        return "bg-gray-500";
      case "cancelled":
      case "rejected":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />

      <main className="pt-16 container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => setLocation(`/dashboard/${user?.role}`)}
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Booking Details */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Booking Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Badge className={getStatusColor(booking.status)}>
                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Date</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(booking.bookingDate), "PPP")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Duration</p>
                      <p className="text-sm text-muted-foreground">
                        {booking.hours} {booking.hours === 1 ? "hour" : "hours"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Location</p>
                      <p className="text-sm text-muted-foreground">
                        {booking.meetingLocation}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Total Amount</p>
                      <p className="text-sm text-muted-foreground">
                        ₦{parseFloat(booking.totalAmount).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {booking.specialRequests && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-2">Special Requests</p>
                    <p className="text-sm text-muted-foreground">
                      {booking.specialRequests}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Chat */}
          <div className="lg:col-span-2">
            {user && (
              <Chat
                bookingId={booking.id}
                currentUserId={user.id}
                otherUserName={otherUserName}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

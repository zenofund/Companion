import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, Heart, Star, MessageCircle, Clock } from "lucide-react";
import { format } from "date-fns";

export default function ClientDashboard() {
  const { data: user } = useQuery({ queryKey: ["/api/auth/me"] });
  const { data: bookings } = useQuery({ queryKey: ["/api/bookings/client"] });
  const { data: stats } = useQuery({ queryKey: ["/api/stats/client"] });

  const activeBookings = bookings?.filter((b: any) => b.status === "active") || [];
  const completedBookings = bookings?.filter((b: any) => b.status === "completed") || [];

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />
      
      <main className="pt-16 container mx-auto px-4 py-8">
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
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-spent">
                ${stats?.totalSpent || "0.00"}
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
        <Tabs defaultValue="bookings" className="w-full">
          <TabsList>
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
                              <DollarSign className="h-4 w-4" />
                              ${booking.totalAmount}
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

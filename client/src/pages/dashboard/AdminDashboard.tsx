import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { 
  Users, 
  DollarSign, 
  Calendar, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Settings
} from "lucide-react";

export default function AdminDashboard() {
  const { data: user } = useQuery({ queryKey: ["/api/auth/me"] });
  const { data: stats } = useQuery({ queryKey: ["/api/admin/stats"] });
  const { data: pendingCompanions } = useQuery({ queryKey: ["/api/admin/pending-companions"] });
  const { data: flaggedContent } = useQuery({ queryKey: ["/api/admin/flagged-content"] });

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />
      
      <main className="pt-16 container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold mb-2" data-testid="text-admin-title">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Platform overview and moderation tools
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-users">
                {stats?.totalUsers || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.newUsers || 0} new this week
              </p>
            </CardContent>
          </Card>

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
              <CardTitle className="text-sm font-medium">Platform Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-revenue">
                ${stats?.platformRevenue || "0.00"}
              </div>
              <p className="text-xs text-muted-foreground">
                This month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-pending-reviews">
                {stats?.pendingReviews || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="companions" className="w-full">
          <TabsList>
            <TabsTrigger value="companions" data-testid="tab-companions">
              Companion Verification
            </TabsTrigger>
            <TabsTrigger value="content" data-testid="tab-content">
              Flagged Content
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="companions" className="mt-6">
            <div className="space-y-4">
              {pendingCompanions && pendingCompanions.length > 0 ? (
                pendingCompanions.map((companion: any) => (
                  <Card key={companion.id} data-testid={`companion-review-${companion.id}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-heading text-lg font-semibold mb-2">
                            {companion.name}
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Email</p>
                              <p className="font-medium">{companion.email}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">City</p>
                              <p className="font-medium">{companion.city}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Rate</p>
                              <p className="font-medium">${companion.hourlyRate}/hr</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Submitted</p>
                              <p className="font-medium">{new Date(companion.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="default" size="sm" data-testid={`button-approve-${companion.id}`}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                          <Button variant="destructive" size="sm" data-testid={`button-reject-${companion.id}`}>
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground" data-testid="text-no-pending">
                      No pending companion verifications
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="content" className="mt-6">
            <Card>
              <CardContent className="p-12 text-center">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground" data-testid="text-no-flagged">
                  No flagged content
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Platform Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Platform Fee Percentage
                  </label>
                  <div className="flex items-center gap-4">
                    <Slider
                      defaultValue={[20]}
                      max={50}
                      step={1}
                      className="flex-1"
                      data-testid="slider-platform-fee"
                    />
                    <span className="font-semibold min-w-[4rem]">20%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Platform takes 20%, companion receives 80% of each booking
                  </p>
                </div>

                <Button data-testid="button-save-settings">
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

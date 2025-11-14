import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Users, 
  Banknote, 
  Calendar, 
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  XCircle,
  Settings,
  Activity,
  Building2
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface PlatformStats {
  totalUsers: number;
  totalCompanions: number;
  totalBookings: number;
  totalRevenue: string;
  pendingModeration: number;
  disputedBookings: number;
}

interface PendingCompanion {
  id: string;
  userId: string;
  city: string;
  bio: string;
  hourlyRate: string;
  moderationStatus: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

interface PlatformSettings {
  platformFeePercentage: string;
}

interface AdminLog {
  id: string;
  adminId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: any;
  createdAt: string;
  adminName?: string;
  adminEmail?: string;
}

interface DisputedBooking {
  id: string;
  clientId: string;
  companionId: string;
  bookingDate: string;
  hours: number;
  totalAmount: string;
  status: string;
  disputeReason?: string;
  disputedAt?: string;
  clientName: string;
  companionName: string;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingCompanionId, setRejectingCompanionId] = useState<string | null>(null);
  const [platformFeeInput, setPlatformFeeInput] = useState("");
  const [resolvingDisputeId, setResolvingDisputeId] = useState<string | null>(null);
  const [resolutionType, setResolutionType] = useState<"complete" | "revoke" | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const { data: user, isLoading: userLoading } = useQuery<any>({ queryKey: ["/api/auth/me"] });
  const { data: stats, isLoading: statsLoading } = useQuery<PlatformStats>({ 
    queryKey: ["/api/admin/stats"],
    enabled: user?.role === "admin",
  });
  
  const { data: pendingCompanions, isLoading: companionsLoading } = useQuery<PendingCompanion[]>({ 
    queryKey: ["/api/admin/pending-companions"],
    enabled: user?.role === "admin",
  });

  const { data: settings, isLoading: settingsLoading } = useQuery<PlatformSettings>({
    queryKey: ["/api/admin/settings"],
    enabled: user?.role === "admin",
  });

  // Set platform fee input when settings load
  useEffect(() => {
    if (settings) {
      setPlatformFeeInput(settings.platformFeePercentage);
    }
  }, [settings]);

  const { data: logs, isLoading: logsLoading } = useQuery<AdminLog[]>({
    queryKey: ["/api/admin/logs"],
    enabled: user?.role === "admin",
  });

  const { data: disputedBookings, isLoading: disputesLoading } = useQuery<DisputedBooking[]>({
    queryKey: ["/api/admin/disputed-bookings"],
    enabled: user?.role === "admin",
  });

  const approveMutation = useMutation({
    mutationFn: async (companionId: string) => {
      return await apiRequest("POST", `/api/admin/companions/${companionId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-companions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
      toast({
        title: "Success",
        description: "Companion profile approved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve companion profile",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ companionId, reason }: { companionId: string; reason: string }) => {
      return await apiRequest("POST", `/api/admin/companions/${companionId}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-companions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
      setRejectingCompanionId(null);
      setRejectReason("");
      toast({
        title: "Success",
        description: "Companion profile rejected",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject companion profile",
        variant: "destructive",
      });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (platformFeePercentage: string) => {
      return await apiRequest("PATCH", "/api/admin/settings", { platformFeePercentage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
      toast({
        title: "Success",
        description: "Platform settings updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const resolveDisputeMutation = useMutation({
    mutationFn: async ({ bookingId, resolution, notes }: { bookingId: string; resolution: "complete" | "revoke"; notes: string }) => {
      return await apiRequest("POST", `/api/admin/bookings/${bookingId}/resolve-dispute`, { resolution, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/disputed-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
      setResolvingDisputeId(null);
      setResolutionType(null);
      setResolutionNotes("");
      toast({
        title: "Success",
        description: "Dispute resolved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resolve dispute",
        variant: "destructive",
      });
    },
  });

  const handleApprove = (companionId: string) => {
    approveMutation.mutate(companionId);
  };

  const handleReject = (companionId: string) => {
    if (!rejectReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }
    rejectMutation.mutate({ companionId, reason: rejectReason });
  };

  const handleSaveSettings = () => {
    const fee = parseFloat(platformFeeInput);
    if (isNaN(fee) || fee < 0 || fee > 100) {
      toast({
        title: "Error",
        description: "Please enter a valid percentage between 0 and 100",
        variant: "destructive",
      });
      return;
    }
    updateSettingsMutation.mutate(platformFeeInput);
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      approve_companion: "Approved Companion",
      reject_companion: "Rejected Companion",
      update_platform_fee: "Updated Platform Fee",
      resolve_dispute: "Resolved Dispute",
    };
    return labels[action] || action;
  };

  const handleResolveDispute = () => {
    if (!resolvingDisputeId || !resolutionType) return;
    
    if (!resolutionNotes.trim()) {
      toast({
        title: "Error",
        description: "Please provide notes for this resolution",
        variant: "destructive",
      });
      return;
    }

    resolveDisputeMutation.mutate({
      bookingId: resolvingDisputeId,
      resolution: resolutionType,
      notes: resolutionNotes,
    });
  };

  // Show loading state while checking authentication
  if (userLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} />
        <main className="pt-28 container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} />
        <main className="pt-28 container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-12 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <p className="text-lg font-semibold">Access Denied</p>
              <p className="text-muted-foreground">You do not have permission to access this page</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="h-8 bg-muted animate-pulse rounded"></div>
              ) : (
                <div className="text-2xl font-bold" data-testid="stat-total-users">
                  {stats?.totalUsers || 0}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Companions</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="h-8 bg-muted animate-pulse rounded"></div>
              ) : (
                <div className="text-2xl font-bold" data-testid="stat-total-companions">
                  {stats?.totalCompanions || 0}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bookings</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="h-8 bg-muted animate-pulse rounded"></div>
              ) : (
                <div className="text-2xl font-bold" data-testid="stat-total-bookings">
                  {stats?.totalBookings || 0}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Platform Revenue</CardTitle>
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="h-8 bg-muted animate-pulse rounded"></div>
              ) : (
                <div className="text-2xl font-bold" data-testid="stat-revenue">
                  ₦{parseFloat(stats?.totalRevenue || "0").toLocaleString()}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="h-8 bg-muted animate-pulse rounded"></div>
              ) : (
                <div className="text-2xl font-bold" data-testid="stat-pending-moderation">
                  {stats?.pendingModeration || 0}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Disputed Bookings</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="h-8 bg-muted animate-pulse rounded"></div>
              ) : (
                <div className="text-2xl font-bold" data-testid="stat-disputed-bookings">
                  {stats?.disputedBookings || 0}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="companions" className="w-full">
          <TabsList>
            <TabsTrigger value="companions" data-testid="tab-companions">
              Companion Moderation ({stats?.pendingModeration || 0})
            </TabsTrigger>
            <TabsTrigger value="disputes" data-testid="tab-disputes">
              Disputes ({stats?.disputedBookings || 0})
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              Platform Settings
            </TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">
              Activity Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="companions" className="mt-6">
            <div className="space-y-4">
              {companionsLoading ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading pending companions...</p>
                  </CardContent>
                </Card>
              ) : pendingCompanions && pendingCompanions.length > 0 ? (
                pendingCompanions.map((companion) => (
                  <Card key={companion.id} data-testid={`companion-review-${companion.id}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            {companion.user.avatar && (
                              <img 
                                src={companion.user.avatar} 
                                alt={companion.user.name}
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            )}
                            <div>
                              <h3 className="font-heading text-lg font-semibold">
                                {companion.user.name}
                              </h3>
                              <p className="text-sm text-muted-foreground">{companion.user.email}</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
                            <div>
                              <p className="text-muted-foreground">City</p>
                              <p className="font-medium">{companion.city}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Hourly Rate</p>
                              <p className="font-medium">₦{parseFloat(companion.hourlyRate).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Submitted</p>
                              <p className="font-medium">{format(new Date(companion.createdAt), "MMM d, yyyy")}</p>
                            </div>
                          </div>

                          {companion.bio && (
                            <div className="mb-4">
                              <p className="text-sm text-muted-foreground mb-1">Bio</p>
                              <p className="text-sm">{companion.bio}</p>
                            </div>
                          )}

                          {rejectingCompanionId === companion.id && (
                            <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                              <Label htmlFor={`reject-reason-${companion.id}`}>Rejection Reason</Label>
                              <Textarea
                                id={`reject-reason-${companion.id}`}
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Provide a reason for rejection..."
                                className="mt-2"
                                data-testid={`textarea-reject-reason-${companion.id}`}
                              />
                              <div className="flex gap-2 mt-4">
                                <Button
                                  onClick={() => handleReject(companion.id)}
                                  variant="destructive"
                                  size="sm"
                                  disabled={rejectMutation.isPending}
                                  data-testid={`button-confirm-reject-${companion.id}`}
                                >
                                  Confirm Rejection
                                </Button>
                                <Button
                                  onClick={() => {
                                    setRejectingCompanionId(null);
                                    setRejectReason("");
                                  }}
                                  variant="outline"
                                  size="sm"
                                  data-testid={`button-cancel-reject-${companion.id}`}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        {rejectingCompanionId !== companion.id && (
                          <div className="flex gap-2">
                            <Button 
                              variant="default" 
                              size="sm" 
                              onClick={() => handleApprove(companion.id)}
                              disabled={approveMutation.isPending}
                              data-testid={`button-approve-${companion.id}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setRejectingCompanionId(companion.id)}
                              data-testid={`button-reject-${companion.id}`}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </div>
                        )}
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

          <TabsContent value="disputes" className="mt-6">
            <div className="space-y-4">
              {disputesLoading ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading disputed bookings...</p>
                  </CardContent>
                </Card>
              ) : disputedBookings && disputedBookings.length > 0 ? (
                disputedBookings.map((dispute) => (
                  <Card key={dispute.id} data-testid={`dispute-card-${dispute.id}`}>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-3">
                              <Badge variant="destructive">Disputed</Badge>
                              <span className="text-sm text-muted-foreground">
                                Booking ID: {dispute.id}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div>
                                <p className="text-sm text-muted-foreground">Client</p>
                                <p className="font-medium" data-testid={`dispute-client-${dispute.id}`}>
                                  {dispute.clientName}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Companion</p>
                                <p className="font-medium" data-testid={`dispute-companion-${dispute.id}`}>
                                  {dispute.companionName}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Booking Date</p>
                                <p className="font-medium">
                                  {format(new Date(dispute.bookingDate), "PPP")}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Amount</p>
                                <p className="font-medium">
                                  ₦{parseFloat(dispute.totalAmount).toLocaleString()}
                                </p>
                              </div>
                              {dispute.disputedAt && (
                                <div>
                                  <p className="text-sm text-muted-foreground">Disputed On</p>
                                  <p className="font-medium">
                                    {format(new Date(dispute.disputedAt), "PPP")}
                                  </p>
                                </div>
                              )}
                            </div>

                            {dispute.disputeReason && (
                              <div className="p-4 bg-muted rounded-lg">
                                <p className="text-sm text-muted-foreground mb-1">Dispute Reason</p>
                                <p className="text-sm" data-testid={`dispute-reason-${dispute.id}`}>
                                  {dispute.disputeReason}
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <Button
                              variant="default"
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
                              onClick={() => {
                                setResolvingDisputeId(dispute.id);
                                setResolutionType("complete");
                              }}
                              data-testid={`button-resolve-complete-${dispute.id}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Resolve (Complete)
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setResolvingDisputeId(dispute.id);
                                setResolutionType("revoke");
                              }}
                              data-testid={`button-resolve-revoke-${dispute.id}`}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Revoke (Cancel)
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground" data-testid="text-no-disputes">
                      No disputed bookings
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Platform Configuration
                </CardTitle>
                <CardDescription>
                  Manage platform-wide settings and payment splits
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {settingsLoading ? (
                  <div className="space-y-4">
                    <div className="h-20 bg-muted animate-pulse rounded"></div>
                    <div className="h-10 w-32 bg-muted animate-pulse rounded"></div>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="platform-fee">Platform Fee Percentage</Label>
                      <div className="flex items-center gap-4 mt-2">
                        <Input
                          id="platform-fee"
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={platformFeeInput}
                          onChange={(e) => setPlatformFeeInput(e.target.value)}
                          className="max-w-[200px]"
                          data-testid="input-platform-fee"
                        />
                        <span className="text-muted-foreground">%</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Platform takes {platformFeeInput}%, companion receives {100 - parseFloat(platformFeeInput || "0")}% of each booking
                      </p>
                    </div>

                    <Button 
                      onClick={handleSaveSettings}
                      disabled={updateSettingsMutation.isPending}
                      data-testid="button-save-settings"
                    >
                      {updateSettingsMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Admin Activity Logs
                </CardTitle>
                <CardDescription>
                  Recent admin actions and system events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {logsLoading ? (
                    <div className="text-center p-8">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
                      <p className="text-muted-foreground">Loading activity logs...</p>
                    </div>
                  ) : logs && logs.length > 0 ? (
                    logs.map((log) => (
                      <div 
                        key={log.id} 
                        className="flex items-start gap-4 p-4 border rounded-lg"
                        data-testid={`log-entry-${log.id}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline">{getActionLabel(log.action)}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")}
                            </span>
                          </div>
                          <p className="text-sm">
                            By: <span className="font-medium">{log.adminName || log.adminEmail || "Admin"}</span>
                          </p>
                          {log.details && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {JSON.stringify(log.details)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center p-8 text-muted-foreground">
                      <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p data-testid="text-no-logs">No activity logs yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Resolve Dispute Dialog */}
      <AlertDialog 
        open={!!resolvingDisputeId} 
        onOpenChange={(open) => {
          if (!open) {
            setResolvingDisputeId(null);
            setResolutionType(null);
            setResolutionNotes("");
          }
        }}
      >
        <AlertDialogContent data-testid="dialog-resolve-dispute">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {resolutionType === "complete" ? "Resolve Dispute (Complete Booking)" : "Resolve Dispute (Revoke Booking)"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {resolutionType === "complete" 
                ? "This will mark the booking as completed and release payment to the companion." 
                : "This will cancel the booking and refund the client."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="resolution-notes">Resolution Notes</Label>
            <Textarea
              id="resolution-notes"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Provide notes about this resolution decision..."
              className="mt-2"
              rows={4}
              data-testid="textarea-resolution-notes"
            />
            <p className="text-xs text-muted-foreground mt-2">
              These notes will be recorded in the admin logs
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-resolve">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleResolveDispute}
              disabled={resolveDisputeMutation.isPending}
              data-testid="button-confirm-resolve"
            >
              {resolveDisputeMutation.isPending ? "Resolving..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

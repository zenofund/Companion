import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useUser } from "@/hooks/useUser";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanionCard } from "@/components/companion/CompanionCard";
import { Heart, MapPin } from "lucide-react";
import { getQueryFn } from "@/lib/queryClient";

export default function Favorites() {
  const { data: user, isLoading: userLoading } = useUser();
  const [, setLocation] = useLocation();

  const { data: favoriteCompanions, isLoading } = useQuery<any[]>({
    queryKey: ["/api/favorites/companions"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user && user.role === "client",
  });

  // Redirect non-clients
  if (userLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!user || user.role !== "client") {
    setLocation("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-28 container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-heading mb-2" data-testid="heading-favorites">
            My Favorites
          </h1>
          <p className="text-muted-foreground">
            View and manage your favorite companions
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="aspect-square bg-muted" />
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded mb-2" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : favoriteCompanions && favoriteCompanions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favoriteCompanions.map((companion: any) => (
              <CompanionCard
                key={companion.id}
                companion={companion}
              />
            ))}
          </div>
        ) : (
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="rounded-full bg-muted p-6">
                <Heart className="h-12 w-12 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold" data-testid="heading-no-favorites">
                  No favorites yet
                </h3>
                <p className="text-muted-foreground max-w-md">
                  Browse companions and add them to your favorites by clicking the heart icon on their profile.
                </p>
              </div>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}

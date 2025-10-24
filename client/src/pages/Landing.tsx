import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CompanionCard } from "@/components/companion/CompanionCard";
import { BookingModal } from "@/components/booking/BookingModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Search, SlidersHorizontal } from "lucide-react";

interface Companion {
  id: string;
  userId: string;
  name?: string;
  avatar?: string;
  city?: string;
  hourlyRate?: string;
  services?: string[];
  isAvailable?: boolean;
  averageRating?: string;
  totalBookings?: number;
  moderationStatus?: string;
  gallery?: string[];
  latitude?: string;
  longitude?: string;
}

export default function Landing() {
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedCompanion, setSelectedCompanion] = useState<Companion | null>(null);

  // Get user's geolocation
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
          // Default to a city center if geolocation fails
          setUserLocation({ lat: 40.7128, lng: -74.0060 }); // New York
        }
      );
    }
  }, []);

  // Fetch companions
  const { data: companions, isLoading } = useQuery<Companion[]>({
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
    ?.filter((c) => c.moderationStatus === "approved")
    .filter((c) => {
      if (!searchQuery) return true;
      return (
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.services?.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    })
    .map((c) => {
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
    .sort((a, b) => (a.distance || 999) - (b.distance || 999));

  return (
    <div className="min-h-screen bg-background">
      <Header viewMode={viewMode} onViewModeChange={setViewMode} />

      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative h-[80vh] flex items-center justify-center overflow-hidden">
          {/* Background Image with Dark Overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-background z-0" />
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1600')] bg-cover bg-center opacity-20 z-0" />

          {/* Hero Content */}
          <div className="relative z-10 text-center max-w-4xl mx-auto px-4">
            <h1 
              className="font-heading text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-foreground"
              data-testid="text-hero-title"
            >
              Find Your Perfect Companion
            </h1>
            <p 
              className="text-xl md:text-2xl text-muted-foreground mb-8"
              data-testid="text-hero-subtitle"
            >
              Discover and book professional companions near you with real-time availability
            </p>

            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search by name, city, or services..."
                  className="pl-10 h-12 bg-background/80 backdrop-blur-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search"
                />
              </div>
              <Button 
                size="lg" 
                className="gap-2 h-12"
                data-testid="button-filters"
              >
                <SlidersHorizontal className="h-5 w-5" />
                Filters
              </Button>
            </div>

            {userLocation && (
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                <MapPin className="h-4 w-4" />
                Showing companions near your location
              </p>
            )}
          </div>
        </section>

        {/* Companions Section */}
        <section className="container mx-auto px-4 py-12">
          {viewMode === "list" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div 
                    key={i} 
                    className="h-[400px] rounded-lg bg-muted animate-pulse"
                    data-testid="skeleton-companion-card"
                  />
                ))
              ) : filteredCompanions && filteredCompanions.length > 0 ? (
                filteredCompanions.map((companion) => (
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
          ) : (
            <div 
              className="h-[600px] rounded-lg bg-muted flex items-center justify-center"
              data-testid="map-container"
            >
              <p className="text-muted-foreground">Map view coming soon</p>
            </div>
          )}
        </section>
      </main>

      {/* Booking Modal */}
      <BookingModal
        open={isBookingModalOpen}
        onOpenChange={setIsBookingModalOpen}
        companion={selectedCompanion}
      />

      {/* Footer */}
      <Footer />
    </div>
  );
}
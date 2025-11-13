import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { BookingModal } from "@/components/booking/BookingModal";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculateAge } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { 
  MapPin, 
  Calendar, 
  Star, 
  CheckCircle, 
  User,
  Globe,
  Heart,
  MessageCircle,
  Briefcase,
  X,
  Banknote,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface Companion {
  id: string;
  userId: string;
  name?: string;
  avatar?: string;
  city?: string;
  dateOfBirth?: string;
  bio?: string;
  services?: string[];
  interests?: string[];
  languages?: string[];
  hourlyRate?: string;
  latitude?: string;
  longitude?: string;
  gallery?: string[];
  isAvailable?: boolean;
  averageRating?: string;
  totalBookings?: number;
  moderationStatus?: string;
}

interface User {
  id: string;
  name?: string;
  avatar?: string;
  role: string;
}

export default function CompanionProfile() {
  const [, params] = useRoute("/companion/:id");
  const [, setLocation] = useLocation();
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: user, isLoading: userLoading } = useQuery<User>({ queryKey: ["/api/auth/me"] });
  const { data: companion, isLoading} = useQuery<Companion>({
    queryKey: ["/api/companions", params?.id],
    enabled: !!params?.id,
  });

  const isClient = user?.role === "client";
  const companionId = params?.id;

  // Check if companion is favorited
  const { data: favoriteData } = useQuery<{ isFavorite: boolean }>({
    queryKey: ["/api/favorites", companionId],
    enabled: isClient && !!companionId,
  });
  const isFavorited = favoriteData?.isFavorite || false;

  // Add favorite mutation
  const addFavoriteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/favorites/${companionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites", companionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/client"] });
      toast({
        title: "Added to favorites",
        description: "Companion added to your favorites list",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add favorite",
        variant: "destructive",
      });
    },
  });

  // Remove favorite mutation
  const removeFavoriteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/favorites/${companionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites", companionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/client"] });
      toast({
        title: "Removed from favorites",
        description: "Companion removed from your favorites list",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove favorite",
        variant: "destructive",
      });
    },
  });

  const handleFavoriteClick = () => {
    if (!user) {
      setLocation("/login");
      return;
    }

    if (!isClient) {
      toast({
        title: "Not available",
        description: "Only clients can favorite companions",
        variant: "destructive",
      });
      return;
    }

    if (isFavorited) {
      removeFavoriteMutation.mutate();
    } else {
      addFavoriteMutation.mutate();
    }
  };

  const handleBookNowClick = () => {
    // Don't proceed if still loading auth state
    if (userLoading) {
      return;
    }
    
    // Redirect to login if not authenticated
    if (!user) {
      setLocation("/login");
      return;
    }
    
    setShowBookingModal(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} />
        <div className="pt-16 container mx-auto px-4 py-8">
          <div className="h-96 bg-muted animate-pulse rounded-lg" />
        </div>
      </div>
    );
  }

  if (!companion) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} />
        <div className="pt-16 container mx-auto px-4 py-8 text-center">
          <p className="text-lg text-muted-foreground">Companion not found</p>
        </div>
      </div>
    );
  }

  const age = calculateAge(companion.dateOfBirth);
  const heroImage = companion.gallery?.[0] || "/placeholder-profile.jpg";

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />
      
      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative h-[500px] overflow-hidden">
          {/* Blurred Background */}
          <div 
            className="absolute inset-0 bg-cover bg-center blur-2xl scale-110"
            style={{ backgroundImage: `url(${heroImage})` }}
          />
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

          {/* Profile Card Overlay */}
          <div className="relative h-full flex items-center justify-center">
            <Card className="max-w-4xl w-full mx-4 overflow-visible">
              <CardContent className="p-8">
                <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                  {/* Avatar */}
                  <Avatar className="h-40 w-40 border-4 border-background shadow-lg">
                    <AvatarImage src={companion.avatar} alt={companion.name} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-4xl">
                      {companion.name?.charAt(0).toUpperCase() || <User />}
                    </AvatarFallback>
                  </Avatar>

                  {/* Info */}
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
                      <h1 
                        className="font-heading text-4xl font-bold"
                        data-testid="text-companion-name"
                      >
                        {companion.name || "Anonymous"}
                      </h1>
                      <CheckCircle className="h-7 w-7 text-primary" />
                      
                      {/* Favorite Button - Only show for clients */}
                      {isClient && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={handleFavoriteClick}
                          disabled={addFavoriteMutation.isPending || removeFavoriteMutation.isPending}
                          data-testid="button-favorite"
                          className="ml-2"
                        >
                          <Heart 
                            className={`h-6 w-6 ${
                              isFavorited 
                                ? "fill-red-500 text-red-500" 
                                : "text-muted-foreground"
                            }`} 
                          />
                        </Button>
                      )}
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                      <div className="text-center md:text-left">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Banknote className="h-4 w-4" />
                          <span className="text-sm">Rate</span>
                        </div>
                        <p 
                          className="font-heading text-2xl font-semibold"
                          data-testid="text-hourly-rate"
                        >
                          ₦{companion.hourlyRate}/hr
                        </p>
                      </div>

                      <div className="text-center md:text-left">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <MapPin className="h-4 w-4" />
                          <span className="text-sm">City</span>
                        </div>
                        <p className="font-heading text-2xl font-semibold" data-testid="text-city">
                          {companion.city || "N/A"}
                        </p>
                      </div>

                      {age && (
                        <div className="text-center md:text-left">
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Calendar className="h-4 w-4" />
                            <span className="text-sm">Age</span>
                          </div>
                          <p className="font-heading text-2xl font-semibold" data-testid="text-age">
                            {age} yrs
                          </p>
                        </div>
                      )}

                      <div className="text-center md:text-left">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Star className="h-4 w-4" />
                          <span className="text-sm">Rating</span>
                        </div>
                        <p className="font-heading text-2xl font-semibold" data-testid="text-rating">
                          {companion.averageRating || "5.0"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Content Sections */}
        <section className="container mx-auto px-4 py-12 max-w-4xl">
          <Tabs defaultValue="about" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="about" data-testid="tab-about">
                <Briefcase className="h-4 w-4 mr-2" />
                About
              </TabsTrigger>
              <TabsTrigger value="gallery" data-testid="tab-gallery">
                <Heart className="h-4 w-4 mr-2" />
                Gallery
              </TabsTrigger>
              <TabsTrigger value="reviews" data-testid="tab-reviews">
                <MessageCircle className="h-4 w-4 mr-2" />
                Reviews
              </TabsTrigger>
            </TabsList>

            <TabsContent value="about" className="space-y-6 mt-6">
              {/* Services */}
              {companion.bio && (
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-heading text-xl font-semibold mb-4">About</h3>
                    <p className="text-muted-foreground leading-relaxed" data-testid="text-bio">
                      {companion.bio}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Services */}
              {companion.services && companion.services.length > 0 && (
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-heading text-xl font-semibold mb-4">Services</h3>
                    <div className="flex flex-wrap gap-2">
                      {companion.services.map((service, index) => (
                        <Badge 
                          key={index} 
                          variant="secondary"
                          className="text-sm px-3 py-1"
                          data-testid={`badge-service-${index}`}
                        >
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Languages */}
              {companion.languages && companion.languages.length > 0 && (
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-heading text-xl font-semibold mb-4 flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      Languages
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {companion.languages.map((language, index) => (
                        <Badge 
                          key={index}
                          variant="outline"
                          data-testid={`badge-language-${index}`}
                        >
                          {language}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Interests */}
              {companion.interests && companion.interests.length > 0 && (
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-heading text-xl font-semibold mb-4 flex items-center gap-2">
                      <Heart className="h-5 w-5" />
                      Interests
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {companion.interests.map((interest, index) => (
                        <Badge 
                          key={index}
                          variant="outline"
                          data-testid={`badge-interest-${index}`}
                        >
                          {interest}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="gallery" className="mt-6">
              <div className="flex overflow-x-auto gap-4 snap-x snap-mandatory scrollbar-hide md:grid md:grid-cols-3 md:overflow-x-visible">
                {companion.gallery?.map((image, index) => (
                  <div
                    key={index}
                    className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover-elevate group flex-shrink-0 w-full snap-center md:w-auto"
                    onClick={() => setLightboxIndex(index)}
                    data-testid={`image-gallery-${index}`}
                  >
                    <img
                      src={image}
                      alt={`Gallery ${index + 1}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="reviews" className="mt-6">
              <ReviewsList companionId={params?.id || ""} />
            </TabsContent>
          </Tabs>
        </section>

        {/* Lightbox */}
        {lightboxIndex !== null && companion.gallery && companion.gallery.length > 0 && (
          <div
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setLightboxIndex(null)}
            data-testid="lightbox-container"
          >
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10"
              onClick={() => setLightboxIndex(null)}
              data-testid="button-close-lightbox"
            >
              <X className="h-6 w-6" />
            </Button>

            {/* Previous Button */}
            {companion.gallery.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((lightboxIndex - 1 + companion.gallery!.length) % companion.gallery!.length);
                }}
                data-testid="button-prev-lightbox"
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
            )}

            {/* Image - Orientation Aware */}
            <img
              src={companion.gallery[lightboxIndex]}
              alt={`Gallery ${lightboxIndex + 1}`}
              className="max-h-[85vh] max-w-[85vw] w-auto h-auto object-contain"
              onClick={(e) => e.stopPropagation()}
              onError={(e) => {
                e.currentTarget.src = "/placeholder-profile.jpg";
              }}
            />

            {/* Next Button */}
            {companion.gallery.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((lightboxIndex + 1) % companion.gallery!.length);
                }}
                data-testid="button-next-lightbox"
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            )}

            {/* Counter */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-foreground bg-background/50 px-4 py-2 rounded-full">
              {lightboxIndex + 1} / {companion.gallery.length}
            </div>
          </div>
        )}

        {/* Sticky Book Now Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t md:hidden">
          <Button 
            className="w-full h-14 text-lg"
            onClick={handleBookNowClick}
            disabled={userLoading}
            data-testid="button-book-now-mobile"
          >
            {userLoading ? "Loading..." : `Book Now - ₦${companion.hourlyRate}/hr`}
          </Button>
        </div>

        <div className="hidden md:block fixed bottom-8 right-8">
          <Button 
            size="lg" 
            className="h-14 px-8 text-lg shadow-lg"
            onClick={handleBookNowClick}
            disabled={userLoading}
            data-testid="button-book-now-desktop"
          >
            {userLoading ? "Loading..." : `Book Now - ₦${companion.hourlyRate}/hr`}
          </Button>
        </div>
      </main>

      {/* Booking Modal */}
      <BookingModal
        open={showBookingModal}
        onOpenChange={setShowBookingModal}
        companion={{
          id: companion.id,
          name: companion.name,
          hourlyRate: companion.hourlyRate,
        }}
      />
    </div>
  );
}

// Helper function to safely format review dates
function formatReviewDate(createdAt?: string | null): string {
  if (!createdAt) return "Recently";
  
  try {
    const date = new Date(createdAt);
    if (!Number.isFinite(date.getTime()) || Number.isNaN(date.getTime())) {
      return "Recently";
    }
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return "Recently";
  }
}

// ReviewsList component
interface Review {
  rating: number;
  review: string;
  createdAt: string;
  reviewerName: string;
  verified: boolean;
}

function ReviewsList({ companionId }: { companionId: string }) {
  const { data: reviews, isLoading } = useQuery<Review[]>({
    queryKey: ["/api/companions", companionId, "reviews"],
    enabled: !!companionId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-1/4"></div>
                <div className="h-4 bg-muted rounded w-full"></div>
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!reviews || reviews.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center py-8" data-testid="text-no-reviews">
            No reviews yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review, index) => (
        <Card key={index} data-testid={`review-${index}`}>
          <CardContent className="p-6 space-y-3">
            {/* Header: Rating and Date */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-4 w-4 ${
                      star <= review.rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                    data-testid={`star-${star}`}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground" data-testid="text-review-date">
                {formatReviewDate(review.createdAt)}
              </span>
            </div>

            {/* Review Text */}
            <p className="text-foreground" data-testid="text-review-content">
              {review.review}
            </p>

            {/* Reviewer Name and Badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium" data-testid="text-reviewer-name">
                {review.reviewerName}
              </span>
              {review.verified && (
                <Badge variant="secondary" className="text-xs" data-testid="badge-verified">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

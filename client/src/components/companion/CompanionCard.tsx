import { Link } from "wouter";
import { MapPin, User, CheckCircle, Clock, Banknote, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { calculateAge } from "@/lib/utils";
import { formatDistance } from "@/lib/geo-utils";

interface CompanionCardProps {
  companion: {
    id: string;
    userId: string;
    name?: string;
    avatar?: string;
    city?: string;
    dateOfBirth?: string;
    hourlyRate?: string;
    services?: string[];
    isAvailable?: boolean;
    averageRating?: string;
    totalBookings?: number;
    moderationStatus?: string;
    gallery?: string[];
  };
  distance?: number;
}

export function CompanionCard({ companion, distance }: CompanionCardProps) {
  const age = calculateAge(companion.dateOfBirth);
  const heroImage = companion.gallery?.[0] || "/placeholder-profile.jpg";
  const displayServices = companion.services?.slice(0, 3) || [];

  if (companion.moderationStatus !== "approved") {
    return null; // Don't show unapproved companions
  }

  return (
    <Card 
      className="group overflow-hidden hover-elevate transition-all duration-200 hover:shadow-lg"
      data-testid={`card-companion-${companion.id}`}
    >
      {/* Hero Image */}
      <div className="relative h-[280px] overflow-hidden">
        <img
          src={heroImage}
          alt={companion.name || "Companion"}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        
        {/* Availability Badge */}
        {companion.isAvailable && (
          <Badge 
            className="absolute top-4 right-4 bg-primary text-primary-foreground gap-1"
            data-testid={`badge-available-${companion.id}`}
          >
            <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
            Available Now
          </Badge>
        )}

        {/* Distance Badge */}
        {distance !== undefined && (
          <Badge 
            className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm text-foreground gap-1.5"
            data-testid={`badge-distance-${companion.id}`}
          >
            <MapPin className="h-3 w-3" />
            {formatDistance(distance)}
          </Badge>
        )}

        {/* Avatar Overlap */}
        <div className="absolute -bottom-8 left-6">
          <Avatar className="h-16 w-16 border-4 border-background">
            <AvatarImage src={companion.avatar} alt={companion.name || "Companion"} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xl">
              {companion.name?.charAt(0).toUpperCase() || <User />}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6 pt-10">
        {/* Name and Verification */}
        <div className="flex items-center gap-2 mb-3">
          <h3 
            className="font-heading text-base sm:text-xl font-semibold truncate flex-1"
            data-testid={`text-name-${companion.id}`}
          >
            {companion.name || "Anonymous"}
          </h3>
          <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" data-testid={`icon-verified-${companion.id}`} />
        </div>

        {/* Stats - Stacked on mobile, horizontal on larger screens */}
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-4 mb-4 text-sm">
          {/* Rate */}
          <div className="flex items-center gap-2" data-testid={`text-rate-${companion.id}`}>
            <Banknote className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium">₦{companion.hourlyRate || "0"}/hr</span>
          </div>
          
          {/* City */}
          {companion.city && (
            <div className="flex items-center gap-2" data-testid={`text-city-${companion.id}`}>
              <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{companion.city}</span>
            </div>
          )}
          
          {/* Age */}
          {age && (
            <div className="flex items-center gap-2" data-testid={`text-age-${companion.id}`}>
              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span>{age} yrs</span>
            </div>
          )}
          
          {/* Rating */}
          {companion.averageRating && (
            <div className="flex items-center gap-2" data-testid={`text-rating-${companion.id}`}>
              <Star className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span>{parseFloat(companion.averageRating).toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Service Tags */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4">
          {displayServices.map((service, index) => (
            <Badge 
              key={index} 
              variant="secondary"
              className="text-[10px] sm:text-xs px-2 py-0.5"
              data-testid={`badge-service-${companion.id}-${index}`}
            >
              {service}
            </Badge>
          ))}
          {(companion.services?.length || 0) > 3 && (
            <Badge variant="secondary" className="text-[10px] sm:text-xs px-2 py-0.5">
              +{(companion.services?.length || 0) - 3}
            </Badge>
          )}
        </div>

        {/* View Profile Button */}
        <Link href={`/companion/${companion.id}`} className="w-full">
          <Button 
            variant="outline" 
            className="w-full text-sm"
            data-testid={`button-view-profile-${companion.id}`}
          >
            View Profile
          </Button>
        </Link>
      </div>
    </Card>
  );
}

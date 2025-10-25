import { Link } from "wouter";
import { MapPin, User, CheckCircle, Clock, Banknote } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { calculateAge } from "@/lib/utils";

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
      <div className="p-6 pt-10">
        {/* Name and Verification */}
        <div className="flex items-center gap-2 mb-3">
          <h3 
            className="font-heading text-xl font-semibold"
            data-testid={`text-name-${companion.id}`}
          >
            {companion.name || "Anonymous"}
          </h3>
          <CheckCircle className="h-5 w-5 text-primary" data-testid={`icon-verified-${companion.id}`} />
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-1" data-testid={`text-rate-${companion.id}`}>
            <Banknote className="h-4 w-4" />
            <span className="font-medium">₦{companion.hourlyRate || "0"}/hr</span>
          </div>
          {distance !== undefined && (
            <div className="flex items-center gap-1" data-testid={`text-distance-${companion.id}`}>
              <MapPin className="h-4 w-4" />
              <span>{distance.toFixed(1)} km</span>
            </div>
          )}
          {age && (
            <div className="flex items-center gap-1" data-testid={`text-age-${companion.id}`}>
              <Clock className="h-4 w-4" />
              <span>{age} yrs</span>
            </div>
          )}
        </div>

        {/* Service Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {displayServices.map((service, index) => (
            <Badge 
              key={index} 
              variant="secondary"
              className="text-xs"
              data-testid={`badge-service-${companion.id}-${index}`}
            >
              {service}
            </Badge>
          ))}
          {(companion.services?.length || 0) > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{(companion.services?.length || 0) - 3} more
            </Badge>
          )}
        </div>

        {/* View Profile Button */}
        <Link href={`/companion/${companion.id}`} className="w-full">
          <Button 
            variant="outline" 
            className="w-full"
            data-testid={`button-view-profile-${companion.id}`}
          >
            View Profile
          </Button>
        </Link>
      </div>
    </Card>
  );
}

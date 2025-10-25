import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useLocation } from "wouter";
import "leaflet/dist/leaflet.css";

// Fix for default marker icons in Leaflet with webpack/vite
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

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
  distance?: number;
}

interface MapViewProps {
  companions: Companion[];
  userLocation: { lat: number; lng: number };
  onCompanionClick?: (companion: Companion) => void;
}

// Component to recenter map when user location changes
function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);
  return null;
}

// Create custom icon for companion markers
function createCompanionIcon(avatar?: string, isAvailable?: boolean): L.DivIcon {
  const avatarUrl = avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=default";
  const statusColor = isAvailable ? "#22c55e" : "#ef4444";
  
  return L.divIcon({
    html: `
      <div style="position: relative; width: 48px; height: 48px;">
        <div style="
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          overflow: hidden;
          background: white;
        ">
          <img 
            src="${avatarUrl}" 
            alt="Companion"
            style="width: 100%; height: 100%; object-fit: cover;"
          />
        </div>
        <div style="
          position: absolute;
          bottom: 0;
          right: 0;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${statusColor};
          border: 2px solid white;
        "></div>
      </div>
    `,
    className: "companion-marker",
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -48],
  });
}

export function MapView({ companions, userLocation, onCompanionClick }: MapViewProps) {
  const [, setLocation] = useLocation();

  if (!userLocation) {
    return (
      <div className="h-full flex items-center justify-center bg-muted rounded-lg">
        <p className="text-muted-foreground">Getting your location...</p>
      </div>
    );
  }

  return (
    <MapContainer
      center={[userLocation.lat, userLocation.lng]}
      zoom={13}
      className="h-full w-full rounded-lg overflow-hidden"
      style={{ height: "100%", minHeight: "600px" }}
    >
      <MapRecenter center={[userLocation.lat, userLocation.lng]} />
      
      {/* Map tiles from OpenStreetMap */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* User location marker */}
      <Marker position={[userLocation.lat, userLocation.lng]}>
        <Popup>
          <div className="text-center">
            <p className="font-medium">Your Location</p>
          </div>
        </Popup>
      </Marker>

      {/* Companion markers */}
      {companions.map((companion) => {
        if (!companion.latitude || !companion.longitude) return null;
        
        const lat = parseFloat(companion.latitude);
        const lng = parseFloat(companion.longitude);
        
        if (isNaN(lat) || isNaN(lng)) return null;

        return (
          <Marker
            key={companion.id}
            position={[lat, lng]}
            icon={createCompanionIcon(companion.avatar, companion.isAvailable)}
            eventHandlers={{
              click: () => {
                if (onCompanionClick) {
                  onCompanionClick(companion);
                } else {
                  setLocation(`/companion/${companion.id}`);
                }
              },
            }}
          >
            <Popup>
              <div className="min-w-[200px]">
                <div className="flex items-center gap-3 mb-2">
                  <img
                    src={companion.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${companion.id}`}
                    alt={companion.name || "Companion"}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <h3 className="font-semibold text-sm">
                      {companion.name || "Unknown"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {companion.city || "Location not set"}
                    </p>
                  </div>
                </div>
                
                {companion.services && companion.services.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-muted-foreground mb-1">Services:</p>
                    <div className="flex flex-wrap gap-1">
                      {companion.services.slice(0, 3).map((service, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-1 bg-primary/10 text-primary rounded"
                        >
                          {service}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Hourly Rate</p>
                    <p className="font-bold text-primary">
                      ₦{companion.hourlyRate || "N/A"}
                    </p>
                  </div>
                  {companion.distance !== undefined && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Distance</p>
                      <p className="font-medium">
                        {companion.distance < 1
                          ? `${(companion.distance * 1000).toFixed(0)}m`
                          : `${companion.distance.toFixed(1)}km`}
                      </p>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setLocation(`/companion/${companion.id}`)}
                  className="w-full mt-3 px-3 py-2 bg-primary text-primary-foreground rounded text-xs font-medium hover:bg-primary/90 transition-colors"
                  data-testid={`button-view-profile-${companion.id}`}
                >
                  View Profile
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

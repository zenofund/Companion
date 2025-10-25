import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  CheckCircle,
  Save,
  MapPin,
  X,
  Image as ImageIcon,
  Camera,
  Upload
} from "lucide-react";
import { BankAccountSetup } from "@/components/payment/BankAccountSetup";
import { fileToBase64, validateImageFile } from "@/lib/imageUtils";

const companionProfileSchema = z.object({
  avatar: z.string().min(1, "Avatar is required").optional(),
  city: z.string().min(2, "City is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  bio: z.string().min(50, "Bio must be at least 50 characters").max(500, "Bio must be less than 500 characters"),
  services: z.array(z.string()).min(1, "Select at least one service"),
  interests: z.array(z.string()).min(1, "Select at least one interest"),
  languages: z.array(z.string()).min(1, "Select at least one language"),
  hourlyRate: z.string().min(1, "Hourly rate is required"),
  latitude: z.string().min(1, "Latitude is required"),
  longitude: z.string().min(1, "Longitude is required"),
  gallery: z.array(z.string().min(1)).max(6, "Maximum 6 gallery images allowed").optional(),
});

type CompanionProfileForm = z.infer<typeof companionProfileSchema>;

const AVAILABLE_SERVICES = [
  "Dinner Companion",
  "Event Attendance",
  "Business Events",
  "City Tours",
  "Travel Companion",
  "Shopping Companion",
  "Networking Events",
  "Social Gatherings",
  "Movie Companion",
  "Casual Outings",
];

const AVAILABLE_LANGUAGES = [
  "English",
  "Yoruba",
  "Igbo",
  "Hausa",
  "French",
  "Spanish",
  "Pidgin",
];

const AVAILABLE_INTERESTS = [
  "Art",
  "Music",
  "Travel",
  "Fashion",
  "Business",
  "Fine Dining",
  "Photography",
  "Cuisine",
  "Technology",
  "Fitness",
  "Sports",
  "Movies",
];

export default function EditProfile() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isCalculatingLocation, setIsCalculatingLocation] = useState(false);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [newGalleryUrl, setNewGalleryUrl] = useState("");

  const { data: user } = useQuery<any>({ queryKey: ["/api/auth/me"] });
  const { data: profile, isLoading } = useQuery<any>({ queryKey: ["/api/companion/profile"] });

  const form = useForm<CompanionProfileForm>({
    resolver: zodResolver(companionProfileSchema),
    values: profile ? {
      avatar: profile.avatar || "",
      city: profile.city || "",
      dateOfBirth: profile.dateOfBirth || "",
      bio: profile.bio || "",
      services: profile.services || [],
      interests: profile.interests || [],
      languages: profile.languages || [],
      hourlyRate: profile.hourlyRate || "",
      latitude: profile.latitude || "",
      longitude: profile.longitude || "",
      gallery: profile.gallery || [],
    } : undefined,
  });

  // Initialize selected items when profile loads
  useEffect(() => {
    if (profile) {
      setSelectedServices(profile.services || []);
      setSelectedLanguages(profile.languages || []);
      setSelectedInterests(profile.interests || []);
      setGalleryUrls(profile.gallery || []);
      form.reset({
        avatar: profile.avatar || "",
        city: profile.city || "",
        dateOfBirth: profile.dateOfBirth || "",
        bio: profile.bio || "",
        services: profile.services || [],
        interests: profile.interests || [],
        languages: profile.languages || [],
        hourlyRate: profile.hourlyRate || "",
        latitude: profile.latitude || "",
        longitude: profile.longitude || "",
        gallery: profile.gallery || [],
      });
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: CompanionProfileForm) => {
      const response = await apiRequest("PUT", "/api/companion/profile", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile updated!",
        description: "Your changes have been saved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/companion/profile"] });
      setLocation("/dashboard/companion");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const toggleService = (service: string) => {
    const newServices = selectedServices.includes(service)
      ? selectedServices.filter((s) => s !== service)
      : [...selectedServices, service];
    setSelectedServices(newServices);
    form.setValue("services", newServices);
  };

  const toggleLanguage = (language: string) => {
    const newLanguages = selectedLanguages.includes(language)
      ? selectedLanguages.filter((l) => l !== language)
      : [...selectedLanguages, language];
    setSelectedLanguages(newLanguages);
    form.setValue("languages", newLanguages);
  };

  const toggleInterest = (interest: string) => {
    const newInterests = selectedInterests.includes(interest)
      ? selectedInterests.filter((i) => i !== interest)
      : [...selectedInterests, interest];
    setSelectedInterests(newInterests);
    form.setValue("interests", newInterests);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast({
        title: "Invalid image",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    try {
      // Compress avatar to 512px max width, 0.8 quality
      const base64 = await fileToBase64(file, 512, 0.8);
      form.setValue("avatar", base64);
      toast({
        title: "Avatar uploaded",
        description: "Profile picture updated successfully",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to process image",
        variant: "destructive",
      });
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 6 - galleryUrls.length;
    if (files.length > remainingSlots) {
      toast({
        title: "Too many images",
        description: `You can only add ${remainingSlots} more image(s)`,
        variant: "destructive",
      });
      return;
    }

    const newImages: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validation = validateImageFile(file);

      if (!validation.valid) {
        errors.push(`File ${i + 1}: ${validation.error}`);
        continue;
      }

      try {
        // Compress gallery images to 1920px max width, 0.8 quality
        const base64 = await fileToBase64(file, 1920, 0.8);
        newImages.push(base64);
      } catch (error) {
        errors.push(`Failed to process file ${i + 1}`);
      }
    }

    if (errors.length > 0) {
      toast({
        title: "Some files failed",
        description: errors.join(", "),
        variant: "destructive",
      });
    }

    if (newImages.length > 0) {
      const updatedGallery = [...galleryUrls, ...newImages];
      setGalleryUrls(updatedGallery);
      form.setValue("gallery", updatedGallery);
      
      toast({
        title: "Images uploaded",
        description: `${newImages.length} image(s) added successfully`,
      });
    }

    // Reset input
    e.target.value = "";
  };

  const removeGalleryImage = (index: number) => {
    const updatedGallery = galleryUrls.filter((_, i) => i !== index);
    setGalleryUrls(updatedGallery);
    form.setValue("gallery", updatedGallery);
  };

  const calculateLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Your browser doesn't support geolocation. Please enter coordinates manually.",
        variant: "destructive",
      });
      return;
    }

    setIsCalculatingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        
        form.setValue("latitude", lat);
        form.setValue("longitude", lng);
        
        toast({
          title: "Location calculated!",
          description: `Coordinates: ${lat}, ${lng}`,
        });
        setIsCalculatingLocation(false);
      },
      (error) => {
        let errorMessage = "Failed to get location";
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location permission denied. Please enable location access in your browser.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable. Please try again.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out. Please try again.";
            break;
        }
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
        setIsCalculatingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const onSubmit = (data: CompanionProfileForm) => {
    updateProfileMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} />
        <div className="pt-16 container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="h-96 bg-muted animate-pulse rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />
      
      <main className="pt-16 container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <h1 className="font-heading text-3xl font-bold mb-2">Edit Profile</h1>
            <p className="text-muted-foreground">
              Update your profile information to attract more clients
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Photos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="avatar"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Profile Picture</FormLabel>
                        <FormControl>
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={handleAvatarUpload}
                                className="hidden"
                                id="avatar-upload"
                                data-testid="input-avatar-file"
                              />
                              <label htmlFor="avatar-upload">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="cursor-pointer"
                                  asChild
                                >
                                  <span>
                                    <Upload className="h-4 w-4 mr-2" />
                                    Choose Photo
                                  </span>
                                </Button>
                              </label>
                              {field.value && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => form.setValue("avatar", "")}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Remove
                                </Button>
                              )}
                            </div>
                            {field.value && (
                              <div className="flex justify-center">
                                <img 
                                  src={field.value} 
                                  alt="Avatar preview" 
                                  className="h-32 w-32 rounded-full object-cover border-4 border-border"
                                  onError={(e) => {
                                    e.currentTarget.src = "/placeholder-profile.jpg";
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormDescription>
                          Upload a profile picture (JPEG, PNG, WebP, or GIF, max 5MB)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div>
                    <FormLabel>Gallery Images (0-6 optional)</FormLabel>
                    <div className="space-y-3 mt-2">
                      <div className="flex gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleGalleryUpload}
                          className="hidden"
                          id="gallery-upload"
                          data-testid="input-gallery-file"
                        />
                        <label htmlFor="gallery-upload" className="flex-1">
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full cursor-pointer"
                            disabled={galleryUrls.length >= 6}
                            asChild
                          >
                            <span>
                              <Upload className="h-4 w-4 mr-2" />
                              Upload Images {galleryUrls.length >= 6 ? "(Max reached)" : ""}
                            </span>
                          </Button>
                        </label>
                      </div>
                      
                      {galleryUrls.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {galleryUrls.map((url, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={url}
                                alt={`Gallery ${index + 1}`}
                                className="w-full h-32 object-cover rounded-lg"
                                onError={(e) => {
                                  e.currentTarget.src = "/placeholder-profile.jpg";
                                }}
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-1 right-1 h-6 w-6"
                                onClick={() => removeGalleryImage(index)}
                                data-testid={`button-remove-gallery-${index}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {galleryUrls.length}/6 images added
                      </p>
                      {form.formState.errors.gallery && (
                        <p className="text-sm text-destructive">{form.formState.errors.gallery.message}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bio</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Tell clients about yourself..."
                            className="min-h-32"
                            data-testid="input-bio"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {field.value?.length || 0}/500 characters
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            data-testid="input-date-of-birth"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Location</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Lagos, Abuja"
                            data-testid="input-city"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={calculateLocation}
                        disabled={isCalculatingLocation}
                        data-testid="button-calculate-location"
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        {isCalculatingLocation ? "Calculating..." : "Calculate Location"}
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="latitude"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Latitude</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.000001"
                                data-testid="input-latitude"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="longitude"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Longitude</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.000001"
                                data-testid="input-longitude"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Services & Interests</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <FormLabel>Services</FormLabel>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {AVAILABLE_SERVICES.map((service) => (
                        <Badge
                          key={service}
                          variant={selectedServices.includes(service) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleService(service)}
                          data-testid={`badge-service-${service}`}
                        >
                          {selectedServices.includes(service) && <CheckCircle className="h-3 w-3 mr-1" />}
                          {service}
                        </Badge>
                      ))}
                    </div>
                    {form.formState.errors.services && (
                      <p className="text-sm text-destructive mt-2">{form.formState.errors.services.message}</p>
                    )}
                  </div>

                  <div>
                    <FormLabel>Languages</FormLabel>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {AVAILABLE_LANGUAGES.map((language) => (
                        <Badge
                          key={language}
                          variant={selectedLanguages.includes(language) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleLanguage(language)}
                          data-testid={`badge-language-${language}`}
                        >
                          {selectedLanguages.includes(language) && <CheckCircle className="h-3 w-3 mr-1" />}
                          {language}
                        </Badge>
                      ))}
                    </div>
                    {form.formState.errors.languages && (
                      <p className="text-sm text-destructive mt-2">{form.formState.errors.languages.message}</p>
                    )}
                  </div>

                  <div>
                    <FormLabel>Interests</FormLabel>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {AVAILABLE_INTERESTS.map((interest) => (
                        <Badge
                          key={interest}
                          variant={selectedInterests.includes(interest) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleInterest(interest)}
                          data-testid={`badge-interest-${interest}`}
                        >
                          {selectedInterests.includes(interest) && <CheckCircle className="h-3 w-3 mr-1" />}
                          {interest}
                        </Badge>
                      ))}
                    </div>
                    {form.formState.errors.interests && (
                      <p className="text-sm text-destructive mt-2">{form.formState.errors.interests.message}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pricing</CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="hourlyRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hourly Rate (₦)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="25000"
                            data-testid="input-hourly-rate"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Set a competitive rate based on your experience
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {!profile?.paystackSubaccountCode && (
                <BankAccountSetup onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/companion/profile"] });
                }} />
              )}

              <div className="flex justify-between gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/dashboard/companion")}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                
                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  data-testid="button-save"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </main>
    </div>
  );
}

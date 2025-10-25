import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Save,
  MapPin,
  X,
  Upload,
  Building2
} from "lucide-react";
import { fileToBase64, validateImageFile } from "@/lib/imageUtils";
import { BankSetupModal } from "@/components/payment/BankSetupModal";

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

type CompanionProfileFormData = z.infer<typeof companionProfileSchema>;

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

interface EditProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProfileSheet({ open, onOpenChange }: EditProfileSheetProps) {
  const { toast } = useToast();
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isCalculatingLocation, setIsCalculatingLocation] = useState(false);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);

  const { data: profile } = useQuery<any>({ queryKey: ["/api/companion/profile"] });

  const form = useForm<CompanionProfileFormData>({
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

  useEffect(() => {
    if (profile) {
      setSelectedServices(profile.services || []);
      setSelectedLanguages(profile.languages || []);
      setSelectedInterests(profile.interests || []);
      setGalleryUrls(profile.gallery || []);
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PATCH", "/api/companion/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companion/profile"] });
      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully",
      });
      onOpenChange(false);
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

    e.target.value = "";
  };

  const removeGalleryImage = (index: number) => {
    const updatedGallery = galleryUrls.filter((_, i) => i !== index);
    setGalleryUrls(updatedGallery);
    form.setValue("gallery", updatedGallery);
  };

  const getCurrentLocation = () => {
    setIsCalculatingLocation(true);
    
    if (!navigator.geolocation) {
      toast({
        title: "Error",
        description: "Geolocation is not supported by your browser",
        variant: "destructive",
      });
      setIsCalculatingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        form.setValue("latitude", position.coords.latitude.toString());
        form.setValue("longitude", position.coords.longitude.toString());
        toast({
          title: "Location updated",
          description: "Your current location has been set",
        });
        setIsCalculatingLocation(false);
      },
      (error) => {
        toast({
          title: "Error",
          description: "Unable to retrieve your location. Please enter manually.",
          variant: "destructive",
        });
        setIsCalculatingLocation(false);
      }
    );
  };

  const handleSubmit = async (data: CompanionProfileFormData) => {
    await updateProfileMutation.mutateAsync(data);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-hidden p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle>Edit Profile</SheetTitle>
          <SheetDescription>
            Update your companion profile information
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)]">
          <div className="px-6 py-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                {/* Photos Section */}
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <h3 className="font-heading text-lg font-semibold">Photos</h3>
                    
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
                                  id="avatar-upload-sheet"
                                  data-testid="input-avatar-file"
                                />
                                <label htmlFor="avatar-upload-sheet">
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
                            id="gallery-upload-sheet"
                            data-testid="input-gallery-file"
                          />
                          <label htmlFor="gallery-upload-sheet" className="flex-1">
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
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Basic Info Section */}
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <h3 className="font-heading text-lg font-semibold">Basic Information</h3>
                    
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="Lagos" data-testid="input-city" {...field} />
                          </FormControl>
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
                            <Input type="date" data-testid="input-dob" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bio</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Tell us about yourself..."
                              className="min-h-[120px]"
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
                  </CardContent>
                </Card>

                {/* Location Section */}
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-heading text-lg font-semibold">Location</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={getCurrentLocation}
                        disabled={isCalculatingLocation}
                        data-testid="button-get-location"
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        {isCalculatingLocation ? "Getting location..." : "Use Current Location"}
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
                              <Input placeholder="6.5244" data-testid="input-latitude" {...field} />
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
                              <Input placeholder="3.3792" data-testid="input-longitude" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Services Section */}
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <h3 className="font-heading text-lg font-semibold">Services & Details</h3>
                    
                    <div>
                      <FormLabel>Services Offered</FormLabel>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {AVAILABLE_SERVICES.map((service) => (
                          <Badge
                            key={service}
                            variant={selectedServices.includes(service) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => toggleService(service)}
                            data-testid={`badge-service-${service.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            {service}
                          </Badge>
                        ))}
                      </div>
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
                            data-testid={`badge-language-${language.toLowerCase()}`}
                          >
                            {language}
                          </Badge>
                        ))}
                      </div>
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
                            data-testid={`badge-interest-${interest.toLowerCase()}`}
                          >
                            {interest}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="hourlyRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hourly Rate (₦)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="10000"
                              data-testid="input-hourly-rate"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Bank Account Setup */}
                {!profile?.paystackSubaccountCode && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-heading text-lg font-semibold mb-2">Payment Setup</h3>
                          <p className="text-sm text-muted-foreground">
                            Link your bank account to receive payments
                          </p>
                        </div>
                        <BankSetupModal />
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-end gap-4 pb-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  
                  <Button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    data-testid="button-save-profile"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

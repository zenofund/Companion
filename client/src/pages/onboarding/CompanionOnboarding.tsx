import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  User, 
  MapPin, 
  Briefcase, 
  Banknote,
  CheckCircle,
  X,
  Camera,
  Image as ImageIcon,
  Upload
} from "lucide-react";
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
  gallery: z.array(z.string().min(1)).min(1, "Add at least 1 gallery image").max(6, "Maximum 6 gallery images allowed"),
});

type CompanionProfileForm = z.infer<typeof companionProfileSchema>;

const STEPS = [
  { id: 1, title: "Photos", icon: Camera },
  { id: 2, title: "Basic Info", icon: User },
  { id: 3, title: "Location", icon: MapPin },
  { id: 4, title: "Services", icon: Briefcase },
  { id: 5, title: "Pricing", icon: Banknote },
];

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

export default function CompanionOnboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [newGalleryUrl, setNewGalleryUrl] = useState("");

  const { data: user } = useQuery({ queryKey: ["/api/auth/me"] });

  const form = useForm<CompanionProfileForm>({
    resolver: zodResolver(companionProfileSchema),
    defaultValues: {
      avatar: "",
      city: "",
      dateOfBirth: "",
      bio: "",
      services: [],
      interests: [],
      languages: [],
      hourlyRate: "",
      latitude: "",
      longitude: "",
      gallery: [],
    },
  });

  const createProfileMutation = useMutation({
    mutationFn: async (data: CompanionProfileForm) => {
      const response = await apiRequest("POST", "/api/companion/profile", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile created!",
        description: "Your profile has been submitted for review.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companion/profile"] });
      setLocation("/dashboard/companion");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create profile",
        variant: "destructive",
      });
    },
  });

  const getLocationFromBrowser = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          form.setValue("latitude", position.coords.latitude.toString());
          form.setValue("longitude", position.coords.longitude.toString());
          toast({
            title: "Location detected",
            description: "We've set your location automatically.",
          });
        },
        (error) => {
          toast({
            title: "Location access denied",
            description: "Please enter your location manually.",
            variant: "destructive",
          });
        }
      );
    }
  };

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
      const base64 = await fileToBase64(file);
      form.setValue("avatar", base64);
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
        const base64 = await fileToBase64(file);
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

  const onSubmit = (data: CompanionProfileForm) => {
    createProfileMutation.mutate(data);
  };

  const nextStep = () => {
    const fieldsToValidate: Record<number, (keyof CompanionProfileForm)[]> = {
      1: ["avatar", "gallery"],
      2: ["bio", "dateOfBirth"],
      3: ["city", "latitude", "longitude"],
      4: ["services", "languages", "interests"],
      5: ["hourlyRate"],
    };

    const fields = fieldsToValidate[currentStep];
    if (fields) {
      form.trigger(fields).then((isValid) => {
        if (isValid) {
          setCurrentStep(currentStep + 1);
        }
      });
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="text-3xl font-heading text-center">
            Welcome to fliQ!
          </CardTitle>
          <CardDescription className="text-center">
            Let's set up your companion profile
          </CardDescription>
          <Progress value={progress} className="mt-4" />
          <div className="flex justify-center gap-2 mt-4">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                    currentStep === step.id
                      ? "bg-primary text-primary-foreground"
                      : currentStep > step.id
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{step.title}</span>
                </div>
              );
            })}
          </div>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Step 1: Photos */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <h3 className="font-heading text-xl font-semibold mb-4">Add your photos</h3>
                  
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
                                id="avatar-upload-onboarding"
                                data-testid="input-avatar-file"
                              />
                              <label htmlFor="avatar-upload-onboarding">
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
                    <FormLabel>Gallery Images (1-6 required)</FormLabel>
                    <div className="space-y-3 mt-2">
                      <div className="flex gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleGalleryUpload}
                          className="hidden"
                          id="gallery-upload-onboarding"
                          data-testid="input-gallery-file"
                        />
                        <label htmlFor="gallery-upload-onboarding" className="flex-1">
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
                </div>
              )}

              {/* Step 2: Basic Info */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <h3 className="font-heading text-xl font-semibold mb-4">Tell us about yourself</h3>
                  
                  <FormField
                    control={form.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bio</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Tell clients about yourself, your personality, and what makes you unique..."
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
                </div>
              )}

              {/* Step 3: Location */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <h3 className="font-heading text-xl font-semibold mb-4">Where are you located?</h3>
                  
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

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={getLocationFromBrowser}
                      data-testid="button-get-location"
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      Use my current location
                    </Button>
                    {userLocation && (
                      <CheckCircle className="h-5 w-5 text-primary" />
                    )}
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
              )}

              {/* Step 4: Services */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <h3 className="font-heading text-xl font-semibold mb-4">What do you offer?</h3>
                  
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
                </div>
              )}

              {/* Step 5: Pricing */}
              {currentStep === 5 && (
                <div className="space-y-4">
                  <h3 className="font-heading text-xl font-semibold mb-4">Set your hourly rate</h3>
                  
                  <FormField
                    control={form.control}
                    name="hourlyRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hourly Rate (₦)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="number"
                              placeholder="25000"
                              className="pl-10"
                              data-testid="input-hourly-rate"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormDescription>
                          Set a competitive rate based on your experience and services offered
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Card className="bg-muted">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">
                        💡 <strong>Pricing Tips:</strong> The average hourly rate in Lagos is ₦20,000 - ₦35,000.
                        Consider your experience, location, and the services you offer when setting your rate.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}


              {/* Navigation Buttons */}
              <div className="flex justify-between pt-6">
                {currentStep > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(currentStep - 1)}
                    data-testid="button-back"
                  >
                    Back
                  </Button>
                )}
                
                <div className="flex-1" />

                {currentStep < STEPS.length ? (
                  <Button
                    type="button"
                    onClick={nextStep}
                    data-testid="button-next"
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={createProfileMutation.isPending}
                    data-testid="button-submit"
                  >
                    {createProfileMutation.isPending ? "Submitting..." : "Complete Profile"}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

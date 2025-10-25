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
  DollarSign,
  Camera,
  CheckCircle,
  X
} from "lucide-react";

const companionProfileSchema = z.object({
  city: z.string().min(2, "City is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  bio: z.string().min(50, "Bio must be at least 50 characters").max(500, "Bio must be less than 500 characters"),
  services: z.array(z.string()).min(1, "Select at least one service"),
  interests: z.array(z.string()).min(1, "Select at least one interest"),
  languages: z.array(z.string()).min(1, "Select at least one language"),
  hourlyRate: z.string().min(1, "Hourly rate is required"),
  latitude: z.string().min(1, "Latitude is required"),
  longitude: z.string().min(1, "Longitude is required"),
  gallery: z.array(z.string()).optional(),
});

type CompanionProfileForm = z.infer<typeof companionProfileSchema>;

const STEPS = [
  { id: 1, title: "Basic Info", icon: User },
  { id: 2, title: "Location", icon: MapPin },
  { id: 3, title: "Services", icon: Briefcase },
  { id: 4, title: "Pricing", icon: DollarSign },
  { id: 5, title: "Gallery", icon: Camera },
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

  const { data: user } = useQuery({ queryKey: ["/api/auth/me"] });

  const form = useForm<CompanionProfileForm>({
    resolver: zodResolver(companionProfileSchema),
    defaultValues: {
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

  const onSubmit = (data: CompanionProfileForm) => {
    createProfileMutation.mutate(data);
  };

  const nextStep = () => {
    const fieldsToValidate: Record<number, (keyof CompanionProfileForm)[]> = {
      1: ["bio", "dateOfBirth"],
      2: ["city", "latitude", "longitude"],
      3: ["services", "languages", "interests"],
      4: ["hourlyRate"],
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
              {/* Step 1: Basic Info */}
              {currentStep === 1 && (
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

              {/* Step 2: Location */}
              {currentStep === 2 && (
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

              {/* Step 3: Services */}
              {currentStep === 3 && (
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

              {/* Step 4: Pricing */}
              {currentStep === 4 && (
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
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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

              {/* Step 5: Gallery */}
              {currentStep === 5 && (
                <div className="space-y-4">
                  <h3 className="font-heading text-xl font-semibold mb-4">Add photos to your profile</h3>
                  
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-2">
                      Photo upload feature coming soon
                    </p>
                    <p className="text-sm text-muted-foreground">
                      For now, you can add photos later from your dashboard
                    </p>
                  </div>

                  <Card className="bg-muted">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">
                        📸 <strong>Photo Guidelines:</strong> Upload at least 3-5 high-quality photos.
                        All photos are reviewed before being published to ensure they meet our community standards.
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

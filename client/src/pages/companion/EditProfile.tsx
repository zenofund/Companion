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
  Save
} from "lucide-react";
import { BankAccountSetup } from "@/components/payment/BankAccountSetup";

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

  const { data: user } = useQuery<any>({ queryKey: ["/api/auth/me"] });
  const { data: profile, isLoading } = useQuery<any>({ queryKey: ["/api/companion/profile"] });

  const form = useForm<CompanionProfileForm>({
    resolver: zodResolver(companionProfileSchema),
    values: profile ? {
      city: profile.city || "",
      dateOfBirth: profile.dateOfBirth || "",
      bio: profile.bio || "",
      services: profile.services || [],
      interests: profile.interests || [],
      languages: profile.languages || [],
      hourlyRate: profile.hourlyRate || "",
      latitude: profile.latitude || "",
      longitude: profile.longitude || "",
    } : undefined,
  });

  // Initialize selected items when profile loads
  useEffect(() => {
    if (profile) {
      setSelectedServices(profile.services || []);
      setSelectedLanguages(profile.languages || []);
      setSelectedInterests(profile.interests || []);
      form.reset({
        city: profile.city || "",
        dateOfBirth: profile.dateOfBirth || "",
        bio: profile.bio || "",
        services: profile.services || [],
        interests: profile.interests || [],
        languages: profile.languages || [],
        hourlyRate: profile.hourlyRate || "",
        latitude: profile.latitude || "",
        longitude: profile.longitude || "",
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

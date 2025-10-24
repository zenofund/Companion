import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: z.enum(["client", "companion"]),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [role, setRole] = useState<"client" | "companion">("client");

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      name: "",
      role: "client",
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterForm) => {
      return await apiRequest("POST", "/api/auth/register", data);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Account created!",
        description: "Welcome to fliQ. Let's get you started.",
      });
      
      if (data.user.role === "companion") {
        setLocation("/onboarding/companion");
      } else {
        setLocation("/dashboard/client");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Registration failed",
        description: error.message || "Could not create account",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RegisterForm) => {
    registerMutation.mutate({ ...data, role });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img 
              src="/attached_assets/fliQ_logo_1761347377488.png" 
              alt="fliQ" 
              className="h-12"
            />
          </div>
          <CardTitle className="text-2xl font-heading">Create Account</CardTitle>
          <CardDescription>Join fliQ and start your journey</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={role} onValueChange={(v) => {
            setRole(v as "client" | "companion");
            form.setValue("role", v as "client" | "companion");
          }}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="client" data-testid="tab-client">
                I'm a Client
              </TabsTrigger>
              <TabsTrigger value="companion" data-testid="tab-companion">
                I'm a Companion
              </TabsTrigger>
            </TabsList>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John Doe"
                          data-testid="input-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          data-testid="input-email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          data-testid="input-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          data-testid="input-confirm-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerMutation.isPending}
                  data-testid="button-submit"
                >
                  {registerMutation.isPending ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </Form>
          </Tabs>

          <div className="mt-6 text-center text-sm">
            <p className="text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline font-medium" data-testid="link-login">
                Sign in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

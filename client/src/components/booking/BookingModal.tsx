import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const bookingSchema = z.object({
  bookingDate: z.string().min(1, "Please select a date"),
  bookingTime: z.string().min(1, "Please select a time"),
  hours: z.number().min(1, "Minimum 1 hour").max(24, "Maximum 24 hours"),
  meetingLocation: z.string().min(5, "Please provide a meeting location"),
  specialRequests: z.string().optional(),
});

type BookingForm = z.infer<typeof bookingSchema>;

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companion: {
    id: string;
    name?: string;
    hourlyRate?: string;
  };
}

export function BookingModal({ open, onOpenChange, companion }: BookingModalProps) {
  const { toast } = useToast();

  // Calculate min and max dates
  const today = new Date().toISOString().split('T')[0];
  const maxDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const form = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      bookingDate: "",
      bookingTime: "12:00",
      hours: 2,
      meetingLocation: "",
      specialRequests: "",
    },
  });

  const hours = form.watch("hours") || 2;
  const hourlyRate = parseFloat(companion.hourlyRate || "0");
  const totalAmount = hours * hourlyRate;

  const bookingMutation = useMutation({
    mutationFn: async (data: BookingForm) => {
      // Combine date and time into ISO string
      const [hours, minutes] = data.bookingTime.split(":");
      const bookingDateTime = new Date(data.bookingDate);
      bookingDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          companionId: companion.id,
          bookingDate: bookingDateTime.toISOString(),
          hours: data.hours,
          meetingLocation: data.meetingLocation,
          specialRequests: data.specialRequests,
          totalAmount: totalAmount.toString(),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      return await response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Booking request sent!",
        description: data.message || "The companion will review your request shortly.",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Booking failed",
        description: error.message || "Could not create booking",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BookingForm) => {
    bookingMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-heading">
            Book {companion.name}
          </DialogTitle>
          <DialogDescription>
            Fill in the details below to request a booking
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Date & Time Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="bookingDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        min={today}
                        max={maxDate}
                        data-testid="input-date"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bookingTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        data-testid="input-time"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Hours */}
            <FormField
              control={form.control}
              name="hours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (hours)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={24}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                      data-testid="input-hours"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Meeting Location */}
            <FormField
              control={form.control}
              name="meetingLocation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meeting Location</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Enter address or location"
                        className="pl-10"
                        data-testid="input-location"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Special Requests */}
            <FormField
              control={form.control}
              name="specialRequests"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Special Requests (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any special requests or notes..."
                      rows={3}
                      data-testid="input-special-requests"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Price Summary */}
            <Card className="p-4 bg-primary/5 border-primary/20">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Hourly Rate</span>
                  <span>₦{hourlyRate}/hr</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Duration</span>
                  <span>{hours} hour{hours !== 1 ? "s" : ""}</span>
                </div>
                <div className="h-px bg-border my-2" />
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span className="text-primary" data-testid="text-total-amount">
                    ₦{totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-14 text-lg"
              disabled={bookingMutation.isPending}
              data-testid="button-proceed-payment"
            >
              {bookingMutation.isPending ? "Processing..." : `Proceed to Payment - ₦${totalAmount.toFixed(2)}`}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

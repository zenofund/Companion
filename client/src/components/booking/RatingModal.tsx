import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RatingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  companionName?: string;
  clientName?: string;
  existingRating?: {
    rating: number;
    review?: string;
  } | null;
  userRole: "client" | "companion";
}

export function RatingModal({
  open,
  onOpenChange,
  bookingId,
  companionName,
  clientName,
  existingRating,
  userRole,
}: RatingModalProps) {
  const [rating, setRating] = useState(existingRating?.rating || 0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [review, setReview] = useState(existingRating?.review || "");
  const { toast } = useToast();

  const submitRatingMutation = useMutation({
    mutationFn: async () => {
      if (rating === 0) {
        throw new Error("Please select a rating");
      }
      return await apiRequest("POST", `/api/bookings/${bookingId}/rate`, {
        rating,
        review: review || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/client"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ratings", bookingId] });
      toast({
        title: "Rating submitted",
        description: "Thank you for your feedback!",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit rating",
        variant: "destructive",
      });
    },
  });

  const targetName = userRole === "client" ? companionName : clientName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="rating-modal">
        <DialogHeader>
          <DialogTitle>
            {existingRating ? "Your Rating" : `Rate ${targetName}`}
          </DialogTitle>
          <DialogDescription>
            {existingRating
              ? "You have already submitted your rating for this booking."
              : `Share your experience with ${targetName}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Star Rating */}
          <div className="flex flex-col items-center space-y-2">
            <p className="text-sm font-medium">
              {existingRating ? "Your Rating" : "How was your experience?"}
            </p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => !existingRating && setRating(star)}
                  onMouseEnter={() => !existingRating && setHoveredRating(star)}
                  onMouseLeave={() => !existingRating && setHoveredRating(0)}
                  disabled={!!existingRating}
                  className="transition-transform hover:scale-110 disabled:cursor-default"
                  data-testid={`star-${star}`}
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= (hoveredRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-sm text-muted-foreground" data-testid="text-rating-value">
                {rating} out of 5 stars
              </p>
            )}
          </div>

          {/* Review Text */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {existingRating ? "Your Review" : "Review (optional)"}
            </label>
            <Textarea
              placeholder={existingRating ? "" : "Share details about your experience..."}
              value={review}
              onChange={(e) => !existingRating && setReview(e.target.value)}
              disabled={!!existingRating}
              className="min-h-[100px] resize-none"
              data-testid="input-review"
            />
          </div>

          {/* Actions */}
          {!existingRating && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={() => submitRatingMutation.mutate()}
                disabled={rating === 0 || submitRatingMutation.isPending}
                data-testid="button-submit-rating"
              >
                {submitRatingMutation.isPending ? "Submitting..." : "Submit Rating"}
              </Button>
            </div>
          )}

          {existingRating && (
            <div className="flex justify-end">
              <Button
                onClick={() => onOpenChange(false)}
                data-testid="button-close"
              >
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

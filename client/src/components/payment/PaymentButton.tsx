import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";

interface PaymentButtonProps {
  paymentUrl: string;
  disabled?: boolean;
  children?: React.ReactNode;
  amount?: number;
}

export function PaymentButton({
  paymentUrl,
  disabled,
  children,
  amount,
}: PaymentButtonProps) {
  const handlePayment = () => {
    // Open Paystack hosted payment page in new window
    window.open(paymentUrl, "_blank", "width=600,height=700");
  };

  return (
    <Button
      onClick={handlePayment}
      disabled={disabled}
      className="w-full"
      data-testid="button-pay-now"
    >
      {disabled ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <CreditCard className="h-4 w-4 mr-2" />
          {children || (amount ? `Pay ₦${amount.toLocaleString()}` : "Pay Now")}
        </>
      )}
    </Button>
  );
}

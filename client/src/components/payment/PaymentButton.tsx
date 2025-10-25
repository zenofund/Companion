import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";

interface PaymentButtonProps {
  email: string;
  amount: number;
  reference: string;
  onSuccess: () => void;
  onClose: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

declare global {
  interface Window {
    PaystackPop?: {
      setup: (config: any) => {
        openIframe: () => void;
      };
    };
  }
}

export function PaymentButton({
  email,
  amount,
  reference,
  onSuccess,
  onClose,
  disabled,
  children,
}: PaymentButtonProps) {
  useEffect(() => {
    // Load Paystack inline script
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handlePayment = () => {
    if (!window.PaystackPop) {
      alert("Payment system is loading. Please try again in a moment.");
      return;
    }

    const handler = window.PaystackPop.setup({
      key: "pk_test_PLACEHOLDER", // This will be replaced with actual public key from backend
      email,
      amount: Math.round(amount * 100), // Convert to kobo
      ref: reference,
      onSuccess: () => {
        onSuccess();
      },
      onClose: () => {
        onClose();
      },
    });

    handler.openIframe();
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
          {children || `Pay ₦${amount.toLocaleString()}`}
        </>
      )}
    </Button>
  );
}

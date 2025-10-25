import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BankAccountSetup } from "./BankAccountSetup";
import { Building2 } from "lucide-react";

interface BankSetupModalProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function BankSetupModal({ trigger, open: controlledOpen, onOpenChange }: BankSetupModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  const handleSuccess = () => {
    setOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" data-testid="button-open-bank-setup">
            <Building2 className="h-4 w-4 mr-2" />
            Link Bank Account
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Bank Account Setup</DialogTitle>
          <DialogDescription>
            Link your bank account to receive payments from bookings. We use Paystack for secure payments with automatic splits.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <BankAccountSetup onSuccess={handleSuccess} showCard={false} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

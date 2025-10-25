import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CheckCircle, Loader2, Building2 } from "lucide-react";

const bankAccountSchema = z.object({
  accountNumber: z.string().length(10, "Account number must be 10 digits"),
  bankCode: z.string().min(1, "Please select a bank"),
});

type BankAccountForm = z.infer<typeof bankAccountSchema>;

interface BankAccountSetupProps {
  onSuccess?: () => void;
  showCard?: boolean;
}

export function BankAccountSetup({ onSuccess, showCard = true }: BankAccountSetupProps) {
  const { toast } = useToast();
  const [verifiedAccountName, setVerifiedAccountName] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const { data: banks, isLoading: banksLoading } = useQuery<Array<{ name: string; code: string }>>({
    queryKey: ["/api/payment/banks"],
  });

  const { data: profile } = useQuery<any>({ queryKey: ["/api/companion/profile"] });

  const form = useForm<BankAccountForm>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: {
      accountNumber: profile?.bankAccountNumber || "",
      bankCode: profile?.bankCode || "",
    },
  });

  // Set verified account name and form values when profile loads
  useEffect(() => {
    if (profile?.bankAccountName) {
      setVerifiedAccountName(profile.bankAccountName);
      form.reset({
        accountNumber: profile.bankAccountNumber || "",
        bankCode: profile.bankCode || "",
      });
    }
  }, [profile]);

  const verifyMutation = useMutation({
    mutationFn: async (data: BankAccountForm) => {
      setIsVerifying(true);
      const response = await apiRequest("POST", "/api/companion/verify-bank", data);
      return await response.json();
    },
    onSuccess: (data) => {
      setVerifiedAccountName(data.account_name);
      setIsVerifying(false);
      toast({
        title: "Bank account verified and saved!",
        description: `Account Name: ${data.account_name}`,
      });
      // Invalidate profile to refresh bank data
      queryClient.invalidateQueries({ queryKey: ["/api/companion/profile"] });
    },
    onError: (error: any) => {
      setIsVerifying(false);
      toast({
        title: "Verification failed",
        description: error.message || "Could not verify bank account",
        variant: "destructive",
      });
    },
  });

  const createSubaccountMutation = useMutation({
    mutationFn: async (data: BankAccountForm) => {
      if (!verifiedAccountName) {
        throw new Error("Please verify account first");
      }
      const response = await apiRequest("POST", "/api/companion/create-subaccount", {
        ...data,
        accountName: verifiedAccountName,
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Bank account linked!",
        description: "Your bank account has been successfully linked for payments.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/companion/profile"] });
      setVerifiedAccountName(null);
      form.reset();
      if (onSuccess) onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Setup failed",
        description: error.message || "Failed to link bank account",
        variant: "destructive",
      });
    },
  });

  const handleVerify = () => {
    const isValid = form.trigger();
    if (!isValid) return;

    const values = form.getValues();
    verifyMutation.mutate(values);
  };

  const handleSubmit = (data: BankAccountForm) => {
    if (!verifiedAccountName) {
      toast({
        title: "Verification required",
        description: "Please verify your bank account first",
        variant: "destructive",
      });
      return;
    }

    createSubaccountMutation.mutate(data);
  };

  const content = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="bankCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bank</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-bank">
                    <SelectValue placeholder="Select your bank" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {banksLoading ? (
                    <div className="p-4 text-center text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                      Loading banks...
                    </div>
                  ) : (
                    banks?.map((bank) => (
                      <SelectItem key={bank.code} value={bank.code}>
                        {bank.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="accountNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Account Number</FormLabel>
              <FormControl>
                <Input
                  placeholder="0123456789"
                  maxLength={10}
                  data-testid="input-account-number"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Your 10-digit bank account number
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {verifiedAccountName && (
          <div className="flex items-center justify-between gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  Account Verified
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {verifiedAccountName}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setVerifiedAccountName(null)}
              data-testid="button-change-account"
            >
              Change
            </Button>
          </div>
        )}

        <div className="flex gap-3">
          {!verifiedAccountName ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleVerify}
              disabled={isVerifying || verifyMutation.isPending}
              className="flex-1"
              data-testid="button-verify-account"
            >
              {isVerifying || verifyMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Building2 className="h-4 w-4 mr-2" />
                  Verify Account
                </>
              )}
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={createSubaccountMutation.isPending}
              className="flex-1"
              data-testid="button-link-account"
            >
              {createSubaccountMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Linking...
                </>
              ) : (
                "Link Account"
              )}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );

  if (!showCard) {
    return content;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bank Account Setup</CardTitle>
        <CardDescription>
          Link your bank account to receive payments from bookings. We use Paystack for secure payments with automatic splits.
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

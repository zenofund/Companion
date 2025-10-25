// Paystack payment integration
import { randomUUID } from "crypto";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = "https://api.paystack.co";

interface PaystackResponse<T = any> {
  status: boolean;
  message: string;
  data: T;
}

async function paystackRequest<T = any>(
  method: string,
  endpoint: string,
  data?: any
): Promise<PaystackResponse<T>> {
  const response = await fetch(`${PAYSTACK_BASE_URL}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Paystack request failed");
  }

  return response.json();
}

export async function initializePayment(
  email: string,
  amount: number,
  metadata: any,
  subaccountCode?: string,
  transactionCharge?: number
): Promise<{ authorization_url: string; reference: string }> {
  const reference = `fliq_${randomUUID()}`;

  const payload: any = {
    email,
    amount: Math.round(amount * 100), // Convert to kobo/cents
    reference,
    metadata,
    callback_url: `${process.env.REPLIT_DEV_DOMAIN || "http://localhost:5000"}/payment/callback`,
  };

  // Add split payment if subaccount is provided
  if (subaccountCode) {
    payload.subaccount = subaccountCode;
    payload.transaction_charge = transactionCharge ? Math.round(transactionCharge * 100) : undefined;
    payload.bearer = "account"; // Platform bears the transaction fee
  }

  const response = await paystackRequest<{
    authorization_url: string;
    reference: string;
  }>("POST", "/transaction/initialize", payload);

  return response.data;
}

export async function verifyPayment(reference: string): Promise<{
  status: string;
  amount: number;
  metadata: any;
}> {
  const response = await paystackRequest<{
    status: string;
    amount: number;
    metadata: any;
  }>("GET", `/transaction/verify/${reference}`);

  return {
    status: response.data.status,
    amount: response.data.amount / 100, // Convert back from kobo/cents
    metadata: response.data.metadata,
  };
}

export async function createSubaccount(
  businessName: string,
  accountNumber: string,
  bankCode: string,
  percentageCharge: number
): Promise<{ subaccount_code: string }> {
  const response = await paystackRequest<{ subaccount_code: string }>(
    "POST",
    "/subaccount",
    {
      business_name: businessName,
      settlement_bank: bankCode,
      account_number: accountNumber,
      percentage_charge: percentageCharge,
    }
  );

  return response.data;
}

export async function verifyBankAccount(
  accountNumber: string,
  bankCode: string
): Promise<{ account_name: string; account_number: string }> {
  const response = await paystackRequest<{
    account_name: string;
    account_number: string;
  }>("GET", `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);

  return response.data;
}

export async function getBanks(): Promise<
  Array<{ name: string; code: string }>
> {
  const response = await paystackRequest<Array<{ name: string; code: string }>>(
    "GET",
    "/bank?country=nigeria"
  );

  return response.data;
}

export function calculateSplitAmounts(
  totalAmount: number,
  platformPercentage: number = 20
): {
  totalAmount: number;
  platformFee: number;
  companionEarning: number;
} {
  const platformFee = Math.round((totalAmount * platformPercentage) / 100);
  const companionEarning = totalAmount - platformFee;

  return {
    totalAmount,
    platformFee,
    companionEarning,
  };
}

import jwt from "jsonwebtoken";
import { DateTime } from "luxon";

export const isSubscriptionValid = (paidUntil: string | null | Date) => {
  if (!paidUntil) return false;
  if (paidUntil instanceof Date) return paidUntil > new Date();
  return DateTime.fromISO(paidUntil) > DateTime.now();
};

export const validatePayment = async (token: string) => {
  try {
    const decoded = jwt.verify(
      token,
      process.env.NEXT_PUBLIC_CRYPTOCLOUD_SECRET || ""
    );
    if (decoded) return true;
  } catch (error: Error | any) {
    console.error("Token validation failed", error?.message);
    return false;
  }
};

export const fetchInvoice = async (invoiceId: string) => {
  const url = "https://api.cryptocloud.plus/v2/invoice/merchant/info";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Token ${process.env.NEXT_PUBLIC_CRYPTOCLOUD_API_KEY}`,
  };

  const data = {
    uuids: [invoiceId],
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });
    const result = await res.json();

    return result;
  } catch (error) {
    console.error(error);
  }
};

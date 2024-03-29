import axios from "axios";
import CryptoJS from "crypto-js";
import { DEFAULT_SUBSCRIPTION_PRICE } from "./constants";

export const retrieveWalletPaymentUrl = async ({
  chatId,
}: {
  chatId: number;
}) => {
  if (!chatId) {
    return new Response("chatId is required", {
      status: 400,
    });
  }
  const url = "https://pay.wallet.tg/wpay/store-api/v1/order";
  const headers = {
    "content-type": "application/json",
    "Wpay-Store-Api-Key": process.env.WALLET_PROD_API_KEY,
    "Content-Type": "application/json",
    "Accept-Encoding": "gzip, deflate",
    Accept: "application/json",
  };

  const body = {
    amount: {
      amount: DEFAULT_SUBSCRIPTION_PRICE,
      currencyCode: "USDT",
    },
    autoConversionCurrency: "USDT",
    description: "Pumpex Spy | 1 month subscription",
    timeoutSeconds: 3600,
    customData: String(chatId),
    externalId: `${chatId}-${Date.now()}`,
    customerTelegramUserId: chatId,
  };

  try {
    const res = await axios.post(url, body, {
      headers,
    });

    return res.data?.data?.directPayLink;
  } catch (e) {
    console.log(e);
  }

  return null;
};

export function verifyWalletSignature(req: Record<string, any>) {
  const secretKey = process.env.WALLET_PROD_API_KEY as string;
  const walletpaySignature = req.headers["walletpay-signature"];
  const timestamp = req.headers["walletpay-timestamp"];

  const httpMethod = req.method;
  const uriPath = req.url; // Ensure this is formatted as in your Store settings
  const body = JSON.stringify(req.body); // Assuming the body is JSON

  // Prepare the string to sign
  const stringToSign = `${httpMethod}.${uriPath}.${timestamp}.${Buffer.from(
    body
  ).toString("base64")}`;

  // Generate HMAC-SHA-256 signature using crypto-js
  const signature = CryptoJS.HmacSHA256(stringToSign, secretKey);
  const base64Signature = CryptoJS.enc.Base64.stringify(signature);

  // Compare the computed signature with the Walletpay-Signature header
  return base64Signature === walletpaySignature;
}

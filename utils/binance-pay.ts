import axios from "axios";
import CryptoJS from "crypto-js";
import { DEFAULT_SUBSCRIPTION_PRICE } from "./constants";

const generateSignature = ({
  timestamp,
  nonce,
  body,
  secretKey,
}: GenerateSignatureParams) => {
  const payload = `${timestamp}\n${nonce}\n${body}\n`;

  const signature = CryptoJS.HmacSHA512(payload, secretKey)
    .toString(CryptoJS.enc.Hex)
    .toUpperCase();
  return signature;
};

export async function retrievePaymentURL({ chatId }: { chatId: string }) {
  if (!chatId) {
    return new Response("chatId is required", {
      status: 400,
    });
  }

  const url = "https://bpay.binanceapi.com/binancepay/openapi/v3/order";
  const timestamp = Date.now();
  const nonce = CryptoJS.lib.WordArray.random(128 / 8).toString(
    CryptoJS.enc.Hex
  );
  const secretKey = process.env.BINANCE_PAY_SECRET_KEY as string;

  const body = {
    env: {
      terminalType: "WEB",
    },
    merchantTradeNo: `${chatId}date${Date.now()}`,
    currency: "USDT",
    orderAmount: DEFAULT_SUBSCRIPTION_PRICE,
    description: "Pumpex Spy | 1 month subscription",
    goodsDetails: [
      {
        goodsType: "02",
        goodsCategory: "Z000",
        referenceGoodsId: chatId,
        goodsName: "PumpEx Spy",
      },
    ],
  };

  const signature = generateSignature({
    timestamp,
    nonce,
    body: JSON.stringify(body),
    secretKey,
  });
  const headers = {
    "content-type": "application/json",
    "BinancePay-Timestamp": timestamp.toString(),
    "BinancePay-Nonce": nonce,
    "BinancePay-Certificate-SN": process.env.BINANCE_PAY_API_KEY, // Ваш API ключ
    "BinancePay-Signature": signature,
  };

  try {
    const response = await axios.post(url, body, { headers });
    return response?.data?.data?.qrContent;
  } catch (error: Error | any) {
    console.error("Error when creating the order:", error?.response?.data);
  }

  return new Response("Failed to obtain checkout url", {
    status: 500,
  });
}

type GenerateSignatureParams = {
  timestamp: number;
  nonce: string;
  body: string;
  secretKey: string;
};

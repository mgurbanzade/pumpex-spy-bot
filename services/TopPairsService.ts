import axios from "axios";
import { sign } from "jsonwebtoken";
import crypto from "crypto";
import { RestClientV5 } from "bybit-api";
import { DateTime } from "luxon";
import Binance from "node-binance-api";

const dataFilePath = "./data/cmc.json";

class TopPairsService {
  public async getTopCoins() {
    const file = Bun.file(dataFilePath);
    const data = await file.json();

    if (
      data.symbols.length > 0 &&
      data.lastFetched &&
      DateTime.fromMillis(data.lastFetched).plus({ days: 3 }).toMillis() >
        Date.now()
    ) {
      console.log("CMC: Returning top coins from cache");
      console.log("-----------------------------------");
      return new Set(data.symbols);
    } else {
      console.log("CMC: Cache is outdated. Fetching top coins", Date.now());
      console.log("-----------------------------------");
      const symbols = await this.fetchTopCoins();
      data.symbols = symbols;
      data.lastFetched = Date.now();
      await Bun.write(dataFilePath, JSON.stringify(data));
      return new Set(symbols);
    }
  }

  private async fetchTopCoins(): Promise<string[]> {
    try {
      const parameters = {
        start: 1,
        limit: 1000,
        sort: "market_cap_strict",
        sort_dir: "desc",
      };
      const headers = {
        Accepts: "application/json",
        "X-CMC_PRO_API_KEY": process.env.COINMARKETCAP_API_KEY,
      };

      const res = await axios.get(
        "https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest",
        {
          headers,
          params: parameters,
        }
      );

      return res?.data?.data.map((coin: any) => ({
        symbol: coin.symbol,
        marketCap: coin.quote.USD.market_cap,
      }));
    } catch (error) {
      console.error("Error fetching top coins", error);
      return [];
    }
  }

  public async getBinanceFutures() {
    const symbols = await this.getTopCoins();
    try {
      const binance = new Binance().options({
        APIKEY: process.env.BINANCE_API_KEY,
        APISECRET: process.env.BINANCE_API_SECRET,
      });

      const tokens1000 = [
        "1000SHIB",
        "1000XEC",
        "1000LUNC",
        "1000PEPE",
        "1000FLOKI",
        "1000BONK",
        "1000SATS",
        "1000RATS",
      ];

      const binanceFutures = await binance.futuresExchangeInfo();
      const futures = Array.from(symbols).reduce((acc: any[], pair: any) => {
        const assets = binanceFutures.symbols.filter((s: any) => {
          if (
            tokens1000.includes(s.baseAsset) &&
            s.baseAsset.split("1000")[1] === pair.symbol
          ) {
            return true;
          }

          return s.baseAsset === pair.symbol && !s.symbol.includes("_");
        });

        return assets.length
          ? [
              ...acc,
              ...assets.map((asset: any) => ({
                pair: asset.symbol,
                marketCap: pair.marketCap,
                baseAsset: asset.baseAsset,
              })),
            ]
          : acc;
      }, []);
      return futures;
    } catch {
      console.log("Error fetching binance futures");
    }
  }

  public async getBybitFutures() {
    const symbols = await this.getTopCoins();
    const tokens1000 = [
      "1000PEPEUSDT",
      "1000BONKUSDT",
      "SHIB1000USDT",
      "1000FLOKIUSDT",
      "1000RATSUSDT",
      "10000STARLUSDT",
      "10000SATSUSDT",
      "10000WENUSDT",
      "10000LADYSUSDT",
      "1000XECUSDT",
      "1000LUNCUSDT",
      "10000000AIDOGEUSDT",
      "1000PEPE-PERP",
      "1000BTTUSDT",
      "1000TURBOUSDT",
      "10000COQUSDT",
      "10000NFTUSDT",
    ];

    try {
      const bybit = new RestClientV5();
      const bybitFutures = await bybit.getTickers({
        category: "linear",
      });

      const futures = Array.from(symbols).reduce((acc: any[], pair: any) => {
        const assets = bybitFutures?.result?.list?.filter((s: any) => {
          if (tokens1000.includes(s.symbol) && s.symbol.includes(pair.symbol)) {
            return (
              s.symbol.replace(/[0-9]/g, "").replace("USDT", "") === pair.symbol
            );
          }
          return (
            s.symbol.split("USDT")[0] === pair.symbol && !s.symbol.includes("-")
          );
        });

        return assets.length
          ? [
              ...acc,
              ...assets.map((asset: any) => ({
                pair: asset.symbol,
                marketCap: pair.marketCap,
                baseAsset: asset.symbol.replace("USDT", ""),
              })),
            ]
          : acc;
      }, []);
      return futures;
    } catch {
      console.log("Error fetching bybit futures");
    }
  }

  public async getCoinbaseFutures() {
    const symbols = await this.getTopCoins();
    const jwtToken = await this.getCoinbaseJWTToken();

    try {
      const res = await axios.get(
        "https://api.coinbase.com/api/v3/brokerage/products",
        {
          headers: {
            Authorization: `Bearer ${jwtToken}`,
          },
          params: {
            product_type: "FUTURE",
            contract_expiry_type: "PERPETUAL",
            expiring_contract_status: "STATUS_ALL",
          },
        }
      );

      if (!res?.data?.products) {
        console.log("No products found on Coinbase");
        return [];
      }

      const tokens1000 = ["1000PEPE PERP"];

      const futures = Array.from(symbols).reduce((acc: any[], pair: any) => {
        const assets = res.data.products.filter((s: any) => {
          const baseAsset = s.display_name
            .replace("PERP", "")
            .trim()
            .split("1000")[1];

          if (
            tokens1000.includes(s.display_name) &&
            baseAsset === pair.symbol
          ) {
            return true;
          }

          return s.display_name.replace("PERP", "").trim() === pair.symbol;
        });

        return assets.length
          ? [
              ...acc,
              ...assets.map((asset: any) => ({
                pair: asset.product_id,
                marketCap: pair.marketCap,
                baseAsset: asset.display_name.replace("PERP", "").trim(),
              })),
            ]
          : acc;
      }, []);

      return futures;
    } catch (error) {
      console.log(error);
    }
  }

  private async getCoinbaseJWTToken() {
    const keyName = process.env.COINBASE_API_KEY;
    const keySecret = process.env.COINBASE_PRIVATE_KEY;
    const requestMethod = "GET";
    const url = "api.coinbase.com";
    const requestPath = "/api/v3/brokerage/products";
    const algorithm = "ES256";
    const uri = requestMethod + " " + url + requestPath;

    const token = sign(
      {
        iss: "coinbase-cloud",
        nbf: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 120,
        sub: keyName,
        uri,
      },
      keySecret as any,
      {
        algorithm,
        header: {
          kid: keyName,
          nonce: crypto.randomBytes(16).toString("hex"),
        },
      } as any
    );

    return token;
  }
}

export default TopPairsService;

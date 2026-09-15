import { Router } from "express";
import {
  buildCompanyListXml,
  buildPurchaseVoucherXml,
  parseCompanyList,
  parsePurchaseVouchers,
  postToTally,
} from "../lib/tally-client.js";

export function createTallyRouter(): Router {
  const router = Router();

  router.post("/connect", async (req, res) => {
    const { host = "localhost", port = 9000 } = req.body as {
      host?: string;
      port?: number;
    };

    try {
      const xml = buildCompanyListXml();
      const response = await postToTally(host, Number(port), xml);
      const companies = parseCompanyList(response);

      if (companies.length === 0) {
        res.status(200).json({
          connected: true,
          companies: [],
          warning:
            "Connected to TallyPrime but no companies found. Please open a company in TallyPrime.",
        });
        return;
      }

      res.json({ connected: true, companies });
    } catch (err) {
      res.status(502).json({
        connected: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to connect to TallyPrime",
      });
    }
  });

  router.post("/purchase-register", async (req, res) => {
    const {
      host = "localhost",
      port = 9000,
      company,
      fromDate,
      toDate,
    } = req.body as {
      host?: string;
      port?: number;
      company?: string;
      fromDate?: string;
      toDate?: string;
    };

    if (!company || !fromDate || !toDate) {
      res.status(400).json({
        error: "Missing required fields: company, fromDate, toDate",
      });
      return;
    }

    try {
      const xml = buildPurchaseVoucherXml(company, fromDate, toDate);
      const response = await postToTally(host, Number(port), xml);
      const records = parsePurchaseVouchers(response);

      res.json({
        records,
        count: records.length,
        company,
        period: { fromDate, toDate },
      });
    } catch (err) {
      res.status(502).json({
        error:
          err instanceof Error
            ? err.message
            : "Failed to fetch data from TallyPrime",
      });
    }
  });

  return router;
}

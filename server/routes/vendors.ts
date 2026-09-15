import { Router } from "express";
import type { Vendor } from "../types.js";

export function createVendorsRouter(vendors: Vendor[]): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(vendors);
  });

  return router;
}

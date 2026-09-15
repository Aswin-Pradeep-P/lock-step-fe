import { randomUUID } from "node:crypto";
import type {
  GSTR2BRecord,
  PurchaseRecord,
  ReconciliationRun,
  Vendor,
} from "../types.js";
import { reconcile } from "./reconciler.js";

function purchase(
  overrides: Partial<PurchaseRecord> & Pick<PurchaseRecord, "voucherRefNo" | "supplier" | "grossTotal">,
): PurchaseRecord {
  const tax = overrides.igstInput ?? overrides.cgstInput ?? overrides.sgstInput ?? 0;
  const igst = overrides.igstInput ?? 0;
  const cgst = overrides.cgstInput ?? 0;
  const sgst = overrides.sgstInput ?? 0;

  return {
    date: "2024-08-15",
    particulars: `Purchase from ${overrides.supplier}`,
    voucherType: "Purchase",
    voucherNo: `PV-${overrides.voucherRefNo}`,
    voucherRefNo: overrides.voucherRefNo,
    voucherRefDate: overrides.voucherRefDate ?? "2024-08-10",
    narration: overrides.narration ?? "Standard purchase entry",
    grossTotal: overrides.grossTotal,
    igstInput: igst,
    cgstInput: cgst,
    sgstInput: sgst,
    ...overrides,
  };
}

function gstr2b(
  overrides: Partial<GSTR2BRecord> &
    Pick<GSTR2BRecord, "invoiceNo" | "tradeName" | "gstin" | "taxableValue"> & {
      igst?: number;
      cgst?: number;
      sgst?: number;
    },
): GSTR2BRecord {
  const igst = overrides.igst ?? 0;
  const cgst = overrides.cgst ?? 0;
  const sgst = overrides.sgst ?? 0;

  return {
    invoiceType: "Regular",
    invoiceDate: overrides.invoiceDate ?? "2024-08-10",
    invoiceValue: overrides.invoiceValue ?? overrides.taxableValue + igst + cgst + sgst,
    placeOfSupply: overrides.placeOfSupply ?? "29-Karnataka",
    reverseCharge: "N",
    igst,
    cgst,
    sgst,
    cess: 0,
    filingPeriod: "082024",
    filingDate: "2024-09-11",
    itcAvailability: "Yes",
    reason: "",
    applicableTaxRate: "18%",
    source: "GSTR-1",
    irn: "",
    irnDate: "",
    ...overrides,
  };
}

function buildSeedRecords(): {
  purchaseRecords: PurchaseRecord[];
  gstr2bRecords: GSTR2BRecord[];
} {
  const purchaseRecords: PurchaseRecord[] = [
    // 8 matched — exact invoice + tax, ITC available
    purchase({
      supplier: "Tata Steel Ltd",
      voucherRefNo: "TSL-2024-0841",
      grossTotal: 118_000,
      igstInput: 18_000,
      date: "2024-08-05",
    }),
    purchase({
      supplier: "Infosys Ltd",
      voucherRefNo: "INF/8842/24",
      grossTotal: 59_000,
      cgstInput: 4_500,
      sgstInput: 4_500,
      date: "2024-08-06",
    }),
    purchase({
      supplier: "Wipro Ltd",
      voucherRefNo: "WPR-2401-119",
      grossTotal: 236_000,
      igstInput: 36_000,
      date: "2024-08-07",
    }),
    purchase({
      supplier: "HDFC Bank Ltd",
      voucherRefNo: "HDFC/BG/9921",
      grossTotal: 82_600,
      igstInput: 12_600,
      date: "2024-08-08",
    }),
    purchase({
      supplier: "Reliance Industries Ltd",
      voucherRefNo: "RIL-INV-3301",
      grossTotal: 472_000,
      igstInput: 72_000,
      date: "2024-08-09",
    }),
    purchase({
      supplier: "Larsen & Toubro Ltd",
      voucherRefNo: "LNT/PO/4412",
      grossTotal: 354_000,
      cgstInput: 27_000,
      sgstInput: 27_000,
      date: "2024-08-10",
    }),
    purchase({
      supplier: "Asian Paints Ltd",
      voucherRefNo: "AP/INV/2208",
      grossTotal: 141_600,
      igstInput: 21_600,
      date: "2024-08-11",
    }),
    purchase({
      supplier: "Bajaj Auto Ltd",
      voucherRefNo: "BAJ/2024/881",
      grossTotal: 295_000,
      cgstInput: 22_500,
      sgstInput: 22_500,
      date: "2024-08-12",
    }),

    // 5 low_risk — fuzzy invoice typos in purchase register
    purchase({
      supplier: "Mahindra & Mahindra Ltd",
      voucherRefNo: "MH-8842",
      grossTotal: 177_000,
      igstInput: 27_000,
      date: "2024-08-13",
    }),
    purchase({
      supplier: "Sun Pharmaceutical Industries Ltd",
      voucherRefNo: "SUN-2401-552",
      grossTotal: 94_400,
      cgstInput: 7_200,
      sgstInput: 7_200,
      date: "2024-08-13",
    }),
    purchase({
      supplier: "HCL Technologies Ltd",
      voucherRefNo: "HCL-9910",
      grossTotal: 129_800,
      igstInput: 19_800,
      date: "2024-08-14",
    }),
    purchase({
      supplier: "ITC Ltd",
      voucherRefNo: "ITC/INV/4402",
      grossTotal: 212_400,
      cgstInput: 16_200,
      sgstInput: 16_200,
      date: "2024-08-14",
    }),
    purchase({
      supplier: "Dr Reddy's Laboratories Ltd",
      voucherRefNo: "DRR-2024-019",
      grossTotal: 165_200,
      igstInput: 25_200,
      date: "2024-08-15",
    }),

    // 4 high_risk — no GSTR-2B entry (vendor did not file)
    purchase({
      supplier: "Shree Ganesh Traders",
      voucherRefNo: "SGT/UNFILED/01",
      grossTotal: 45_000,
      igstInput: 5_000,
      date: "2024-08-16",
    }),
    purchase({
      supplier: "Kumar Electricals Pvt Ltd",
      voucherRefNo: "KEL-8841",
      grossTotal: 78_500,
      cgstInput: 5_975,
      sgstInput: 5_975,
      date: "2024-08-16",
    }),
    purchase({
      supplier: "Patel Hardware Mart",
      voucherRefNo: "PHM-2024-112",
      grossTotal: 32_400,
      igstInput: 4_900,
      date: "2024-08-17",
    }),
    purchase({
      supplier: "Sri Lakshmi Agencies",
      voucherRefNo: "SLA/INV/009",
      grossTotal: 56_800,
      igstInput: 8_700,
      date: "2024-08-17",
    }),

    // 3 cannot_file — exact match in GSTR-2B but ITC blocked
    purchase({
      supplier: "Vedanta Ltd",
      voucherRefNo: "VED/ITC-BLOCK/01",
      grossTotal: 590_000,
      igstInput: 90_000,
      date: "2024-08-18",
    }),
    purchase({
      supplier: "Adani Enterprises Ltd",
      voucherRefNo: "AEL-BLOCK-442",
      grossTotal: 413_000,
      cgstInput: 31_500,
      sgstInput: 31_500,
      date: "2024-08-18",
    }),
    purchase({
      supplier: "JSW Steel Ltd",
      voucherRefNo: "JSW/NO-ITC/778",
      grossTotal: 826_000,
      igstInput: 126_000,
      date: "2024-08-19",
    }),
  ];

  const gstr2bRecords: GSTR2BRecord[] = [
    // Matched pairs
    gstr2b({
      gstin: "27AAACT2727Q1ZW",
      tradeName: "Tata Steel Ltd",
      invoiceNo: "TSL-2024-0841",
      taxableValue: 100_000,
      igst: 18_000,
    }),
    gstr2b({
      gstin: "29AAACI4798L1ZV",
      tradeName: "Infosys Ltd",
      invoiceNo: "INF/8842/24",
      taxableValue: 50_000,
      cgst: 4_500,
      sgst: 4_500,
      placeOfSupply: "29-Karnataka",
    }),
    gstr2b({
      gstin: "29AAACW3745R1ZJ",
      tradeName: "Wipro Ltd",
      invoiceNo: "WPR-2401-119",
      taxableValue: 200_000,
      igst: 36_000,
    }),
    gstr2b({
      gstin: "27AAACH2702H1Z9",
      tradeName: "HDFC Bank Ltd",
      invoiceNo: "HDFC/BG/9921",
      taxableValue: 70_000,
      igst: 12_600,
    }),
    gstr2b({
      gstin: "27AAACR5055K1Z5",
      tradeName: "Reliance Industries Ltd",
      invoiceNo: "RIL-INV-3301",
      taxableValue: 400_000,
      igst: 72_000,
    }),
    gstr2b({
      gstin: "27AAACL0140P1ZP",
      tradeName: "Larsen & Toubro Ltd",
      invoiceNo: "LNT/PO/4412",
      taxableValue: 300_000,
      cgst: 27_000,
      sgst: 27_000,
      placeOfSupply: "27-Maharashtra",
    }),
    gstr2b({
      gstin: "27AAACA0963E1Z4",
      tradeName: "Asian Paints Ltd",
      invoiceNo: "AP/INV/2208",
      taxableValue: 120_000,
      igst: 21_600,
    }),
    gstr2b({
      gstin: "27AAACB2894G1ZN",
      tradeName: "Bajaj Auto Ltd",
      invoiceNo: "BAJ/2024/881",
      taxableValue: 250_000,
      cgst: 22_500,
      sgst: 22_500,
      placeOfSupply: "27-Maharashtra",
    }),

    // Fuzzy pairs — GSTR-2B has correct invoice numbers
    gstr2b({
      gstin: "27AAACL0786P1Z2",
      tradeName: "Mahindra & Mahindra Ltd",
      invoiceNo: "MH-884Z",
      taxableValue: 150_000,
      igst: 27_000,
    }),
    gstr2b({
      gstin: "24AAACS0464J1ZU",
      tradeName: "Sun Pharmaceutical Industries Ltd",
      invoiceNo: "SUN-24O1-552",
      taxableValue: 80_000,
      cgst: 7_200,
      sgst: 7_200,
      placeOfSupply: "24-Gujarat",
    }),
    gstr2b({
      gstin: "06AAACH4815G1Z5",
      tradeName: "HCL Technologies Ltd",
      invoiceNo: "HCL-991O",
      taxableValue: 110_000,
      igst: 19_800,
      placeOfSupply: "06-Haryana",
    }),
    gstr2b({
      gstin: "33AAACI5957H1Z9",
      tradeName: "ITC Ltd",
      invoiceNo: "ITC/INV/44O2",
      taxableValue: 180_000,
      cgst: 16_200,
      sgst: 16_200,
      placeOfSupply: "33-Tamil Nadu",
    }),
    gstr2b({
      gstin: "36AAACD1461F1Z5",
      tradeName: "Dr Reddy's Laboratories Ltd",
      invoiceNo: "DRR-2O24-019",
      taxableValue: 140_000,
      igst: 25_200,
      placeOfSupply: "36-Telangana",
    }),

    // Cannot file — exact match but ITC unavailable
    gstr2b({
      gstin: "08AAACV2801H1Z3",
      tradeName: "Vedanta Ltd",
      invoiceNo: "VED/ITC-BLOCK/01",
      taxableValue: 500_000,
      igst: 90_000,
      itcAvailability: "No",
      reason: "Rule 37 default — payment not made within 180 days",
    }),
    gstr2b({
      gstin: "24AAACA6190C1Z5",
      tradeName: "Adani Enterprises Ltd",
      invoiceNo: "AEL-BLOCK-442",
      taxableValue: 350_000,
      cgst: 31_500,
      sgst: 31_500,
      placeOfSupply: "24-Gujarat",
      itcAvailability: "No",
      reason: "Supplier return not filed for the tax period",
    }),
    gstr2b({
      gstin: "29AAACJ4321N1Z8",
      tradeName: "JSW Steel Ltd",
      invoiceNo: "JSW/NO-ITC/778",
      taxableValue: 700_000,
      igst: 126_000,
      itcAvailability: "No",
      reason: "ITC restricted under Section 17(5)",
    }),
  ];

  return { purchaseRecords, gstr2bRecords };
}

export const seedVendors: Vendor[] = [
  {
    id: randomUUID(),
    name: "Tata Steel Ltd",
    gstin: "27AAACT2727Q1ZW",
    riskScore: 12,
    riskTier: "green",
    lastFilingDate: "2024-09-11",
    totalInvoices: 48,
    missedFilings: 0,
  },
  {
    id: randomUUID(),
    name: "Infosys Ltd",
    gstin: "29AAACI4798L1ZV",
    riskScore: 8,
    riskTier: "green",
    lastFilingDate: "2024-09-11",
    totalInvoices: 36,
    missedFilings: 0,
  },
  {
    id: randomUUID(),
    name: "Mahindra & Mahindra Ltd",
    gstin: "27AAACL0786P1Z2",
    riskScore: 28,
    riskTier: "green",
    lastFilingDate: "2024-09-11",
    totalInvoices: 22,
    missedFilings: 0,
  },
  {
    id: randomUUID(),
    name: "Sun Pharmaceutical Industries Ltd",
    gstin: "24AAACS0464J1ZU",
    riskScore: 35,
    riskTier: "amber",
    lastFilingDate: "2024-09-10",
    totalInvoices: 19,
    missedFilings: 1,
  },
  {
    id: randomUUID(),
    name: "HCL Technologies Ltd",
    gstin: "06AAACH4815G1Z5",
    riskScore: 42,
    riskTier: "amber",
    lastFilingDate: "2024-09-08",
    totalInvoices: 15,
    missedFilings: 1,
  },
  {
    id: randomUUID(),
    name: "Shree Ganesh Traders",
    gstin: "29AABCS1234F1Z7",
    riskScore: 78,
    riskTier: "red",
    lastFilingDate: "2024-06-11",
    totalInvoices: 8,
    missedFilings: 3,
  },
  {
    id: randomUUID(),
    name: "Kumar Electricals Pvt Ltd",
    gstin: "29AABCK5678G1Z3",
    riskScore: 85,
    riskTier: "red",
    lastFilingDate: "2024-05-11",
    totalInvoices: 12,
    missedFilings: 4,
  },
  {
    id: randomUUID(),
    name: "Vedanta Ltd",
    gstin: "08AAACV2801H1Z3",
    riskScore: 55,
    riskTier: "amber",
    lastFilingDate: "2024-09-11",
    totalInvoices: 31,
    missedFilings: 0,
  },
  {
    id: randomUUID(),
    name: "Adani Enterprises Ltd",
    gstin: "24AAACA6190C1Z5",
    riskScore: 68,
    riskTier: "amber",
    lastFilingDate: "2024-09-05",
    totalInvoices: 27,
    missedFilings: 1,
  },
  {
    id: randomUUID(),
    name: "JSW Steel Ltd",
    gstin: "29AAACJ4321N1Z8",
    riskScore: 72,
    riskTier: "red",
    lastFilingDate: "2024-09-11",
    totalInvoices: 24,
    missedFilings: 0,
  },
];

export function createSeedRun(): ReconciliationRun {
  const { purchaseRecords, gstr2bRecords } = buildSeedRecords();

  const run = reconcile(
    purchaseRecords,
    gstr2bRecords,
    "Purchase_Register_Aug2024.xlsx",
    "GSTR2B_Aug2024.xlsx",
  );

  return {
    ...run,
    id: randomUUID(),
    createdAt: "2024-09-15T10:30:00.000Z",
  };
}

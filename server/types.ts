export type RiskCategory = "matched" | "low_risk" | "high_risk" | "cannot_file";

export interface PurchaseRecord {
  date: string;
  particulars: string;
  supplier: string;
  voucherType: string;
  voucherNo: string;
  voucherRefNo: string;
  voucherRefDate: string;
  narration: string;
  grossTotal: number;
  igstInput?: number;
  cgstInput?: number;
  sgstInput?: number;
}

export interface GSTR2BRecord {
  gstin: string;
  tradeName: string;
  invoiceNo: string;
  invoiceType: string;
  invoiceDate: string;
  invoiceValue: number;
  placeOfSupply: string;
  reverseCharge: string;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  filingPeriod: string;
  filingDate: string;
  itcAvailability: string;
  reason: string;
  applicableTaxRate: string;
  source: string;
  irn: string;
  irnDate: string;
}

export interface ReconciledRecord {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  supplierName: string;
  gstin: string;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  totalTax: number;
  status: RiskCategory;
  matchConfidence: number;
  aiSummary: string;
  action: "none" | "ignore" | "flag" | "escalate";
  purchaseRecord?: PurchaseRecord;
  gstr2bRecord?: GSTR2BRecord;
}

export interface ReconciliationRun {
  id: string;
  createdAt: string;
  purchaseFileName: string;
  gstr2bFileName: string;
  totalRecords: number;
  matchedCount: number;
  lowRiskCount: number;
  highRiskCount: number;
  cannotFileCount: number;
  totalTaxableValue: number;
  totalTaxAtRisk: number;
  records: ReconciledRecord[];
}

export interface ReconciliationRunSummary {
  id: string;
  createdAt: string;
  purchaseFileName: string;
  gstr2bFileName: string;
  totalRecords: number;
  matchedCount: number;
  lowRiskCount: number;
  highRiskCount: number;
  cannotFileCount: number;
  totalTaxableValue: number;
  totalTaxAtRisk: number;
}

export interface Vendor {
  id: string;
  name: string;
  gstin: string;
  riskScore: number;
  riskTier: "green" | "amber" | "red";
  lastFilingDate: string;
  totalInvoices: number;
  missedFilings: number;
}

export interface ReconcileRequest {
  purchaseRecords: PurchaseRecord[];
  gstr2bRecords: GSTR2BRecord[];
  purchaseFileName: string;
  gstr2bFileName: string;
}

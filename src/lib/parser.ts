import * as XLSX from "xlsx";
import Papa from "papaparse";
import type { PurchaseRecord, GSTR2BRecord } from "@/types";

export type FileType = "purchase" | "gstr2b";

function isXlsx(file: File): boolean {
  return (
    file.name.endsWith(".xlsx") ||
    file.name.endsWith(".xls") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function toNumber(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

function toStr(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

function parsePurchaseRows(rows: Record<string, unknown>[]): PurchaseRecord[] {
  return rows
    .filter((row) => {
      const date = toStr(row["Date"] ?? row["date"]);
      return date && date !== "Grand Total" && date !== "";
    })
    .map((row) => ({
      date: toStr(row["Date"] ?? row["date"]),
      particulars: toStr(row["Particulars"] ?? row["particulars"]),
      supplier: toStr(
        row["Buyer/Supplier"] ?? row["buyer/supplier"] ?? row["Supplier"]
      ),
      voucherType: toStr(row["Voucher Type"] ?? row["voucherType"]),
      voucherNo: toStr(row["Voucher No."] ?? row["voucherNo"]),
      voucherRefNo: toStr(row["Voucher Ref. No."] ?? row["voucherRefNo"]),
      voucherRefDate: toStr(row["Voucher Ref. Date"] ?? row["voucherRefDate"]),
      narration: toStr(row["Narration"] ?? row["narration"]),
      grossTotal: toNumber(row["Gross Total"] ?? row["grossTotal"]),
      igstInput: toNumber(row["IGST Input"] ?? row["igstInput"]),
      cgstInput: toNumber(row["CGST Input"] ?? row["cgstInput"]),
      sgstInput: toNumber(row["SGST Input"] ?? row["sgstInput"]),
    }));
}

function parseGSTR2BRows(rows: Record<string, unknown>[]): GSTR2BRecord[] {
  return rows
    .filter((row) => {
      const gstin = toStr(
        row["GSTIN of supplier"] ?? row["gstin"] ?? row["GSTIN"]
      );
      return gstin && gstin.length >= 15;
    })
    .map((row) => ({
      gstin: toStr(row["GSTIN of supplier"] ?? row["gstin"] ?? row["GSTIN"]),
      tradeName: toStr(
        row["Trade/Legal name"] ?? row["tradeName"] ?? row["Trade Name"]
      ),
      invoiceNo: toStr(
        row["Invoice number"] ?? row["invoiceNo"] ?? row["Invoice No"]
      ),
      invoiceType: toStr(
        row["Invoice type"] ?? row["invoiceType"] ?? row["Invoice Type"]
      ),
      invoiceDate: toStr(
        row["Invoice Date"] ?? row["invoiceDate"] ?? row["Inv Date"]
      ),
      invoiceValue: toNumber(
        row["Invoice Value(₹)"] ??
          row["invoiceValue"] ??
          row["Invoice Value"]
      ),
      placeOfSupply: toStr(
        row["Place of supply"] ?? row["placeOfSupply"] ?? row["POS"]
      ),
      reverseCharge: toStr(
        row["Supply Attract Reverse Charge"] ??
          row["reverseCharge"] ??
          row["Reverse Charge"]
      ),
      taxableValue: toNumber(
        row["Taxable Value (₹)"] ??
          row["taxableValue"] ??
          row["Taxable Value"]
      ),
      igst: toNumber(
        row["Integrated Tax(₹)"] ?? row["igst"] ?? row["IGST"]
      ),
      cgst: toNumber(row["Central Tax(₹)"] ?? row["cgst"] ?? row["CGST"]),
      sgst: toNumber(
        row["State/UT Tax(₹)"] ?? row["sgst"] ?? row["SGST"]
      ),
      cess: toNumber(row["Cess(₹)"] ?? row["cess"] ?? row["Cess"]),
      filingPeriod: toStr(
        row["GSTR-1/IFF/GSTR-5 Period"] ??
          row["filingPeriod"] ??
          row["Filing Period"]
      ),
      filingDate: toStr(
        row["GSTR-1/IFF/GSTR-5 Filing Date"] ??
          row["filingDate"] ??
          row["Filing Date"]
      ),
      itcAvailability: toStr(
        row["ITC Availability"] ?? row["itcAvailability"]
      ),
      reason: toStr(row["Reason"] ?? row["reason"]),
      applicableTaxRate: toStr(
        row["Applicable % of Tax Rate"] ??
          row["applicableTaxRate"] ??
          row["Tax Rate"]
      ),
      source: toStr(row["Source"] ?? row["source"]),
      irn: toStr(row["IRN"] ?? row["irn"]),
      irnDate: toStr(row["IRN Date"] ?? row["irnDate"]),
    }));
}

export async function parseFile(
  file: File,
  type: FileType
): Promise<PurchaseRecord[] | GSTR2BRecord[]> {
  if (isXlsx(file)) {
    const buffer = await readFileAsArrayBuffer(file);
    const workbook = XLSX.read(buffer, { type: "array" });

    if (type === "gstr2b") {
      const sheetName =
        workbook.SheetNames.find((n) =>
          n.toLowerCase().includes("gstr")
        ) || workbook.SheetNames.find((n) =>
          n.toLowerCase().includes("2b")
        ) || workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        range: 4,
      });
      return parseGSTR2BRows(rows);
    } else {
      const sheetName =
        workbook.SheetNames.find(
          (n) =>
            n.toLowerCase().includes("tally") ||
            n.toLowerCase().includes("igst") ||
            n.toLowerCase().includes("cgst")
        ) || workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        range: 4,
      });
      return parsePurchaseRows(rows);
    }
  } else {
    const text = await readFileAsText(file);
    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as Record<string, unknown>[];
          if (type === "gstr2b") {
            resolve(parseGSTR2BRows(rows));
          } else {
            resolve(parsePurchaseRows(rows));
          }
        },
        error: reject,
      });
    });
  }
}

export async function getPreviewRows(
  file: File,
  type?: FileType
): Promise<Record<string, unknown>[]> {
  if (isXlsx(file)) {
    const buffer = await readFileAsArrayBuffer(file);
    const workbook = XLSX.read(buffer, { type: "array" });

    let sheetName: string;
    if (type === "gstr2b") {
      sheetName =
        workbook.SheetNames.find((n) => n.toLowerCase().includes("gstr")) ||
        workbook.SheetNames.find((n) => n.toLowerCase().includes("2b")) ||
        workbook.SheetNames[0];
    } else if (type === "purchase") {
      sheetName =
        workbook.SheetNames.find(
          (n) =>
            n.toLowerCase().includes("tally") ||
            n.toLowerCase().includes("igst") ||
            n.toLowerCase().includes("cgst")
        ) || workbook.SheetNames[0];
    } else {
      sheetName = workbook.SheetNames[0];
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      range: 4,
    });
    return rows.slice(0, 5);
  } else {
    const text = await readFileAsText(file);
    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        preview: 5,
        complete: (results) => {
          resolve(results.data as Record<string, unknown>[]);
        },
        error: reject,
      });
    });
  }
}

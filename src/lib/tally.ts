/** Direct XML integration with TallyPrime's HTTP API.
 * All requests go through the Vite dev proxy `/tally` → `localhost:9000`. */

export interface TallyConnectionResult {
  connected: boolean;
  companies: string[];
  warning?: string;
}

export interface TallyPurchaseRecord {
  invoice_number: string;
  invoice_date: string;
  vendor_name: string;
  vendor_gstin: string;
  taxable_value: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  total_tax: number;
}

export interface TallyPurchaseResult {
  records: TallyPurchaseRecord[];
  count: number;
  company: string;
}


/** Tally rejects a company name containing raw XML metacharacters. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Tally emits control characters XML forbids — a real export carries
 * "&#4; Not Applicable" in CSTFORMISSUETYPE. Harmless for regex parsing, but it
 * would otherwise ride along into the CSV we hand the backend.
 */
function stripIllegalChars(xml: string): string {
  return xml.replace(/&#(\d+);/g, (match, code) => (Number(code) < 32 ? "" : match));
}

async function postXml(xml: string): Promise<string> {
  const response = await fetch("/tally", {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body: xml,
  });
  if (!response.ok) {
    throw new Error(`TallyPrime connection failed (${response.status})`);
  }
  return stripIllegalChars(await response.text());
}

/** Tally escapes its XML, so a party named "Laxmi Electricals & Trading Co" arrives
 *  as "...&amp;...". Left encoded, it never matches the same vendor in GSTR-2B. */
function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractTagValues(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "gi");
  const values: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    values.push(decodeXml(match[1].trim()));
  }
  return values;
}

function extractTagValue(xml: string, tag: string, defaultVal = ""): string {
  const values = extractTagValues(xml, tag);
  return values.length > 0 ? values[0] : defaultVal;
}

export async function checkTallyConnection(): Promise<TallyConnectionResult> {
  try {
    // "List of Companies" is a COLLECTION, not a report. Asking for it as a report
    // gets "Could not find Report 'List of Companies'!" and the connection silently
    // reads as offline.
    const xml = `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>List of Companies</ID>
  </HEADER>
  <BODY><DESC><STATICVARIABLES>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
  </STATICVARIABLES></DESC></BODY>
</ENVELOPE>`;

    const response = await postXml(xml);
    const companies = [...response.matchAll(/<COMPANY\s+NAME="([^"]+)"/gi)]
      .map((m) => m[1].trim())
      .concat(extractTagValues(response, "SVCCOMPANY"))
      .filter((c) => c.length > 0 && !c.startsWith("##"));

    const unique = [...new Set(companies)];

    return {
      connected: true,
      companies: unique.length > 0 ? unique : ["Default Company"],
      warning: unique.length === 0 ? "Connected but no companies found — using default" : undefined,
    };
  } catch {
    return { connected: false, companies: [] };
  }
}

export async function fetchTallyPurchaseRegister(
  company: string,
  fromDate?: string,
  toDate?: string,
): Promise<TallyPurchaseResult> {
  // "Day Book" returns a single collapsed voucher no matter the date range. The
  // Voucher Register data export is the one that actually yields every voucher with
  // its ledger entries. Dates must carry TYPE="Date" or Tally ignores them entirely
  // and falls back to the company's current period.
  const dateFilter =
    fromDate && toDate
      ? `<SVFROMDATE TYPE="Date">${fromDate}</SVFROMDATE>
    <SVTODATE TYPE="Date">${toDate}</SVTODATE>`
      : "";

  const xml = `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Voucher Register</ID>
  </HEADER>
  <BODY><DESC><STATICVARIABLES>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
    <SVCURRENTCOMPANY>${escapeXml(company)}</SVCURRENTCOMPANY>
    ${dateFilter}
    <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
  </STATICVARIABLES></DESC></BODY>
</ENVELOPE>`;

  const response = await postXml(xml);
  const vouchers = response.split(/<VOUCHER /i).slice(1);

  const records: TallyPurchaseRecord[] = [];
  for (const v of vouchers) {
    const voucherType = extractTagValue(v, "VOUCHERTYPENAME").toUpperCase();
    if (!voucherType.includes("PURCHASE")) continue;

    const partyName = extractTagValue(v, "PARTYLEDGERNAME");
    // REFERENCE is the SUPPLIER's bill number — the only one GSTR-2B has ever seen.
    // VOUCHERNUMBER is our own internal number (Tally even re-numbers it on import),
    // so preferring it would make every invoice look missing.
    const voucherNumber = extractTagValue(v, "REFERENCE") || extractTagValue(v, "VOUCHERNUMBER");
    // Likewise REFERENCEDATE is the invoice date; DATE is when we booked it.
    const dateRaw = extractTagValue(v, "REFERENCEDATE") || extractTagValue(v, "DATE");

    const allAmounts = extractTagValues(v, "AMOUNT").map(Number).filter((n) => !isNaN(n));
    const totalAmount = allAmounts.length > 0 ? Math.abs(allAmounts[0]) : 0;

    const gstin = extractTagValue(v, "PARTYGSTIN") || extractTagValue(v, "GSTREGISTRATION");

    // Tally keeps GST in the ledger entries, not in IGSTAMOUNT-style tags, so read the
    // tax off the entry whose ledger is named for that head. The old 18% fallback
    // INVENTED a tax figure whenever those tags were absent — which was always — and
    // an invented number is the one thing a tax tool must never show.
    const taxes = { igst: 0, cgst: 0, sgst: 0, cess: 0 };
    for (const entry of v.split(/<ALLLEDGERENTRIES\.LIST>|<LEDGERENTRIES\.LIST>/i).slice(1)) {
      const ledger = extractTagValue(entry, "LEDGERNAME").toLowerCase();
      const amount = Math.abs(Number(extractTagValue(entry, "AMOUNT")) || 0);
      if (!amount) continue;
      if (ledger.includes("igst") || ledger.includes("integrated")) taxes.igst += amount;
      else if (ledger.includes("cgst") || ledger.includes("central")) taxes.cgst += amount;
      else if (ledger.includes("sgst") || ledger.includes("utgst") || ledger.includes("state"))
        taxes.sgst += amount;
      else if (ledger.includes("cess")) taxes.cess += amount;
    }
    const { igst, cgst, sgst, cess } = taxes;
    const totalTax = igst + cgst + sgst + cess;

    records.push({
      invoice_number: voucherNumber || `TALLY-${records.length + 1}`,
      invoice_date: dateRaw
        ? `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`
        : new Date().toISOString().slice(0, 10),
      vendor_name: partyName || "Unknown",
      vendor_gstin: gstin,
      taxable_value: totalAmount - totalTax,
      igst,
      cgst,
      sgst,
      cess,
      total_tax: totalTax,
    });
  }

  return { records, count: records.length, company };
}

/** Convert Tally records to a CSV File object that can be uploaded to the backend. */
export function tallyRecordsToCsvFile(records: TallyPurchaseRecord[]): File {
  const header = "Invoice Number,Invoice Date,Vendor Name,GSTIN,Taxable Value,IGST,CGST,SGST,Cess,Total Tax";
  const rows = records.map((r) =>
    [
      r.invoice_number,
      r.invoice_date,
      `"${r.vendor_name.replace(/"/g, '""')}"`,
      r.vendor_gstin,
      r.taxable_value.toFixed(2),
      r.igst.toFixed(2),
      r.cgst.toFixed(2),
      r.sgst.toFixed(2),
      r.cess.toFixed(2),
      r.total_tax.toFixed(2),
    ].join(","),
  );
  const csv = [header, ...rows].join("\n");
  return new File([csv], "tally_purchase_register.csv", { type: "text/csv" });
}

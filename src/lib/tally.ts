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

async function postXml(xml: string): Promise<string> {
  const response = await fetch("/tally", {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body: xml,
  });
  if (!response.ok) {
    throw new Error(`TallyPrime connection failed (${response.status})`);
  }
  return response.text();
}

function extractTagValues(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "gi");
  const values: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    values.push(match[1].trim());
  }
  return values;
}

function extractTagValue(xml: string, tag: string, defaultVal = ""): string {
  const values = extractTagValues(xml, tag);
  return values.length > 0 ? values[0] : defaultVal;
}

export async function checkTallyConnection(): Promise<TallyConnectionResult> {
  try {
    const xml = `<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY><EXPORTDATA>
    <REQUESTDESC><REPORTNAME>List of Companies</REPORTNAME></REQUESTDESC>
  </EXPORTDATA></BODY>
</ENVELOPE>`;

    const response = await postXml(xml);
    const companies = extractTagValues(response, "SVCCOMPANY")
      .concat(extractTagValues(response, "NAME"))
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
  fromDate: string,
  toDate: string,
): Promise<TallyPurchaseResult> {
  const xml = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>
          <SVFROMDATE>${fromDate}</SVFROMDATE>
          <SVTODATE>${toDate}</SVTODATE>
        </STATICVARIABLES>
        <REPORTNAME>Day Book</REPORTNAME>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

  const response = await postXml(xml);
  const vouchers = response.split(/<VOUCHER /i).slice(1);

  const records: TallyPurchaseRecord[] = [];
  for (const v of vouchers) {
    const voucherType = extractTagValue(v, "VOUCHERTYPENAME").toUpperCase();
    if (!voucherType.includes("PURCHASE")) continue;

    const partyName = extractTagValue(v, "PARTYLEDGERNAME");
    const voucherNumber = extractTagValue(v, "VOUCHERNUMBER") || extractTagValue(v, "REFERENCE");
    const dateRaw = extractTagValue(v, "DATE");

    const allAmounts = extractTagValues(v, "AMOUNT").map(Number).filter((n) => !isNaN(n));
    const totalAmount = allAmounts.length > 0 ? Math.abs(allAmounts[0]) : 0;

    const gstin = extractTagValue(v, "PARTYGSTIN") || extractTagValue(v, "GSTREGISTRATION");

    const igst = Math.abs(Number(extractTagValue(v, "IGSTAMOUNT")) || 0);
    const cgst = Math.abs(Number(extractTagValue(v, "CGSTAMOUNT")) || 0);
    const sgst = Math.abs(Number(extractTagValue(v, "SGSTAMOUNT")) || 0);
    const cess = Math.abs(Number(extractTagValue(v, "CESSAMOUNT")) || 0);
    const totalTax = igst + cgst + sgst + cess || totalAmount * 0.18;

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

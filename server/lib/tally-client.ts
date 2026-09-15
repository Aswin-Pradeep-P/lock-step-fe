import http from "node:http";
import { XMLParser } from "fast-xml-parser";
import type { PurchaseRecord } from "../types.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) =>
    ["VOUCHER", "LEDGERENTRIES.LIST", "COMPANY"].includes(name),
});

export function buildCompanyListXml(): string {
  return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>List of Companies</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

export function buildPurchaseVoucherXml(
  company: string,
  fromDate: string,
  toDate: string,
): string {
  return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Voucher Register</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>
        <SVFROMDATE TYPE="DATE">${fromDate}</SVFROMDATE>
        <SVTODATE TYPE="DATE">${toDate}</SVTODATE>
        <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

export function postToTally(
  host: string,
  port: number,
  xmlBody: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: host,
        port,
        method: "POST",
        headers: {
          "Content-Type": "text/xml",
          "Content-Length": Buffer.byteLength(xmlBody),
        },
        timeout: 30_000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => resolve(data));
      },
    );

    req.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ECONNREFUSED") {
        reject(
          new Error(
            `Cannot connect to TallyPrime at ${host}:${port}. Make sure TallyPrime is running with the HTTP server enabled.`,
          ),
        );
      } else if (err.code === "ETIMEDOUT" || (err as any).code === "ESOCKETTIMEDOUT") {
        reject(
          new Error(
            `Connection to TallyPrime at ${host}:${port} timed out. Check the host and port.`,
          ),
        );
      } else {
        reject(new Error(`Failed to connect to TallyPrime: ${err.message}`));
      }
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Connection to TallyPrime at ${host}:${port} timed out.`));
    });

    req.write(xmlBody);
    req.end();
  });
}

function checkForTallyError(parsed: any): void {
  const lineError =
    parsed?.ENVELOPE?.BODY?.DATA?.LINEERROR ??
    parsed?.ENVELOPE?.BODY?.LINEERROR;
  if (lineError) {
    throw new Error(`TallyPrime error: ${lineError}`);
  }
}

export function parseCompanyList(xml: string): string[] {
  const parsed = parser.parse(xml);
  checkForTallyError(parsed);

  const collection =
    parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION ??
    parsed?.ENVELOPE?.BODY?.COLLECTION;

  if (!collection) return [];

  const companies: any[] = collection.COMPANY ?? [];
  return companies
    .map((c: any) => (typeof c === "string" ? c : c.NAME ?? c["#text"] ?? ""))
    .filter(Boolean);
}

function toStr(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

function toNum(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : Math.abs(n);
}

function formatTallyDate(raw: string): string {
  const s = raw.replace(/[^0-9]/g, "");
  if (s.length === 8) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  return raw;
}

export function parsePurchaseVouchers(xml: string): PurchaseRecord[] {
  const parsed = parser.parse(xml);
  checkForTallyError(parsed);

  const tallyMessage =
    parsed?.ENVELOPE?.BODY?.DATA?.TALLYMESSAGE ??
    parsed?.ENVELOPE?.BODY?.TALLYMESSAGE;

  if (!tallyMessage) return [];

  const vouchers: any[] = tallyMessage.VOUCHER ?? [];
  const records: PurchaseRecord[] = [];

  for (const v of vouchers) {
    const voucherType = toStr(v.VOUCHERTYPENAME);
    if (voucherType.toLowerCase() !== "purchase") continue;

    let igstInput = 0;
    let cgstInput = 0;
    let sgstInput = 0;
    let grossTotal = toNum(v.AMOUNT);

    const ledgerEntries: any[] = v["LEDGERENTRIES.LIST"] ?? [];
    for (const entry of ledgerEntries) {
      const name = toStr(entry.LEDGERNAME).toLowerCase();
      const amount = toNum(entry.AMOUNT);
      if (name.includes("igst")) igstInput = amount;
      else if (name.includes("cgst")) cgstInput = amount;
      else if (name.includes("sgst")) sgstInput = amount;
    }

    const record: PurchaseRecord = {
      date: formatTallyDate(toStr(v.DATE ?? v.EFFECTIVEDATE)),
      particulars: toStr(v.NARRATION || v.PARTYLEDGERNAME),
      supplier: toStr(v.PARTYLEDGERNAME),
      voucherType,
      voucherNo: toStr(v.VOUCHERNUMBER),
      voucherRefNo: toStr(v.REFERENCE || v.INVOICENUMBER || v.VOUCHERNUMBER),
      voucherRefDate: formatTallyDate(toStr(v.REFERENCEDATE || v.DATE)),
      narration: toStr(v.NARRATION),
      grossTotal,
      igstInput,
      cgstInput,
      sgstInput,
    };

    records.push(record);
  }

  return records;
}

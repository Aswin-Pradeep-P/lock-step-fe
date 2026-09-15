import { createServer } from "node:http";

const MOCK_TALLY_PORT = 9000;

const COMPANIES = ["Acme Trading Co", "Pinnacle Exports Ltd"];

function companyListXml(): string {
  const items = COMPANIES.map(
    (name) => `<COMPANY><NAME>${name}</NAME></COMPANY>`
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <BODY>
    <DATA>
      <COLLECTION>
        ${items}
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>`;
}

interface MockVoucher {
  date: string;
  supplier: string;
  voucherNo: string;
  refNo: string;
  refDate: string;
  narration: string;
  grossTotal: number;
  igst: number;
  cgst: number;
  sgst: number;
  particulars: string;
}

const MOCK_VOUCHERS: MockVoucher[] = [
  { date: "20240801", supplier: "CloudNine Technologies Pvt Ltd", voucherNo: "PV-CN-001", refNo: "CN/INV/2024/801", refDate: "20240728", narration: "Annual cloud hosting renewal", grossTotal: 236000, igst: 36000, cgst: 0, sgst: 0, particulars: "Server Hosting" },
  { date: "20240802", supplier: "Prestige Stationery House", voucherNo: "PV-PSH-002", refNo: "PSH-8802", refDate: "20240730", narration: "Bulk stationery order for Q3", grossTotal: 23600, igst: 0, cgst: 1800, sgst: 1800, particulars: "Office Supplies" },
  { date: "20240803", supplier: "Steelcraft Industries Ltd", voucherNo: "PV-SC-003", refNo: "SCI/PO/4410", refDate: "20240801", narration: "MS flat bars 500kg", grossTotal: 590000, igst: 90000, cgst: 0, sgst: 0, particulars: "Raw Materials" },
  { date: "20240804", supplier: "BrightMinds Consulting LLP", voucherNo: "PV-BM-004", refNo: "BM-2024-1178", refDate: "20240801", narration: "SAP implementation Phase 2", grossTotal: 354000, igst: 54000, cgst: 0, sgst: 0, particulars: "Professional Services" },
  { date: "20240805", supplier: "Laxmi Electricals & Trading Co", voucherNo: "PV-LET-005", refNo: "LET/INV/0556", refDate: "20240802", narration: "Panel boards and MCBs", grossTotal: 141600, igst: 21600, cgst: 0, sgst: 0, particulars: "Electrical Components" },
  { date: "20240806", supplier: "Horizon Realty Partners", voucherNo: "PV-HRP-006", refNo: "HRP/RENT/AUG24", refDate: "20240801", narration: "Office rent August 2024", grossTotal: 177000, igst: 0, cgst: 13500, sgst: 13500, particulars: "Office Rent" },
  { date: "20240807", supplier: "DigiWorld Systems Pvt Ltd", voucherNo: "PV-DW-007", refNo: "DWS-24-3344", refDate: "20240803", narration: "Laptop and peripherals x10", grossTotal: 472000, igst: 72000, cgst: 0, sgst: 0, particulars: "IT Equipment" },
  { date: "20240808", supplier: "FastTrack Cargo Services", voucherNo: "PV-FTC-008", refNo: "FTC/BL/9921", refDate: "20240804", narration: "Freight charges Chennai-Bangalore", grossTotal: 82600, igst: 12600, cgst: 0, sgst: 0, particulars: "Logistics" },
  { date: "20240809", supplier: "GreenPack Solutions", voucherNo: "PV-GPS-009", refNo: "GPS-2024-221", refDate: "20240804", narration: "Corrugated boxes 2000 units", grossTotal: 59000, igst: 9000, cgst: 0, sgst: 0, particulars: "Packaging Material" },
  { date: "20240810", supplier: "ShieldGuard Enterprises", voucherNo: "PV-SGE-010", refNo: "SGE/INV/AUG-01", refDate: "20240805", narration: "Monthly security contract", grossTotal: 94400, igst: 0, cgst: 7200, sgst: 7200, particulars: "Security Services" },
  { date: "20240811", supplier: "Apex Chemicals Pvt Ltd", voucherNo: "PV-AC-011", refNo: "APEX-0881", refDate: "20240806", narration: "Industrial solvents 200L", grossTotal: 165200, igst: 25200, cgst: 0, sgst: 0, particulars: "Chemical Supplies" },
  { date: "20240812", supplier: "Bharat Heavy Works", voucherNo: "PV-BHW-012", refNo: "BHW/SP/4419", refDate: "20240807", narration: "CNC spindle replacement", grossTotal: 295000, igst: 45000, cgst: 0, sgst: 0, particulars: "Machinery Parts" },
  { date: "20240813", supplier: "Annapurna Food Services", voucherNo: "PV-AFS-013", refNo: "AFS/INV/1334", refDate: "20240808", narration: "Monthly canteen contract Aug", grossTotal: 45000, igst: 0, cgst: 3438, sgst: 3438, particulars: "Catering" },
  { date: "20240814", supplier: "Nandi Logistics Pvt Ltd", voucherNo: "PV-NL-014", refNo: "NL-WB-7782", refDate: "20240809", narration: "Warehouse to port transport", grossTotal: 78500, igst: 11950, cgst: 0, sgst: 0, particulars: "Transport" },
  { date: "20240815", supplier: "Sai Analytical Labs", voucherNo: "PV-SAL-015", refNo: "SAL/RPT/2024-55", refDate: "20240810", narration: "Quality testing batch QA-445", grossTotal: 32400, igst: 4940, cgst: 0, sgst: 0, particulars: "Lab Testing" },
  { date: "20240816", supplier: "Metro Office Interiors", voucherNo: "PV-MOI-016", refNo: "MOI/QT/2024-88", refDate: "20240811", narration: "Ergonomic chairs x20", grossTotal: 186000, igst: 28356, cgst: 0, sgst: 0, particulars: "Office Furniture" },
  { date: "20240817", supplier: "TechnoSoft India", voucherNo: "PV-TSI-017", refNo: "TSI-LIC-4420", refDate: "20240812", narration: "Annual ERP license renewal", grossTotal: 425000, igst: 64788, cgst: 0, sgst: 0, particulars: "Software License" },
  { date: "20240818", supplier: "Reliable Power Systems", voucherNo: "PV-RPS-018", refNo: "RPS/INV/9001", refDate: "20240813", narration: "UPS battery replacement", grossTotal: 67000, igst: 10212, cgst: 0, sgst: 0, particulars: "Electrical Maintenance" },
  { date: "20240819", supplier: "SafeVault Insurance Brokers", voucherNo: "PV-SVB-019", refNo: "SVB/POL/AUG-24", refDate: "20240801", narration: "Factory insurance premium Q3", grossTotal: 92000, igst: 0, cgst: 7020, sgst: 7020, particulars: "Insurance" },
  { date: "20240820", supplier: "Zenith Print & Packaging", voucherNo: "PV-ZPP-020", refNo: "ZPP/INV/3345", refDate: "20240815", narration: "Product labels 50000 units", grossTotal: 38000, igst: 5793, cgst: 0, sgst: 0, particulars: "Printing" },
  { date: "20240821", supplier: "Kiran Transport Agency", voucherNo: "PV-KTA-021", refNo: "KTA/FRT/6678", refDate: "20240816", narration: "Inter-state freight Aug batch 1", grossTotal: 55000, igst: 8385, cgst: 0, sgst: 0, particulars: "Freight" },
  { date: "20240822", supplier: "Vishwa Cleaning Solutions", voucherNo: "PV-VCS-022", refNo: "VCS/MNT/AUG24", refDate: "20240801", narration: "Monthly housekeeping August", grossTotal: 28000, igst: 0, cgst: 2138, sgst: 2138, particulars: "Housekeeping" },
  { date: "20240823", supplier: "PrimeTech Components", voucherNo: "PV-PTC-023", refNo: "PTC/SO/7891", refDate: "20240818", narration: "PCB boards and connectors", grossTotal: 312000, igst: 47568, cgst: 0, sgst: 0, particulars: "Electronic Components" },
  { date: "20240824", supplier: "National Bearings Co", voucherNo: "PV-NBC-024", refNo: "NBC/INV/2244", refDate: "20240819", narration: "Industrial bearings SKF lot", grossTotal: 148000, igst: 22560, cgst: 0, sgst: 0, particulars: "Machinery Spares" },
  { date: "20240825", supplier: "Sanjay Petroleum", voucherNo: "PV-SP-025", refNo: "SP/FUEL/AUG-3", refDate: "20240820", narration: "Diesel for generators Aug", grossTotal: 75000, igst: 11432, cgst: 0, sgst: 0, particulars: "Fuel" },
  { date: "20240826", supplier: "CloudNine Technologies Pvt Ltd", voucherNo: "PV-CN-026", refNo: "CN/INV/2024/815", refDate: "20240821", narration: "Additional bandwidth upgrade", grossTotal: 45000, igst: 6860, cgst: 0, sgst: 0, particulars: "Internet Services" },
  { date: "20240827", supplier: "Elite Fabricators", voucherNo: "PV-EF-027", refNo: "EF/WO/3322", refDate: "20240822", narration: "Custom steel fabrication work", grossTotal: 225000, igst: 34305, cgst: 0, sgst: 0, particulars: "Fabrication" },
  { date: "20240828", supplier: "Steelcraft Industries Ltd", voucherNo: "PV-SC-028", refNo: "SCI/PO/4425", refDate: "20240823", narration: "SS sheets 200kg follow-up order", grossTotal: 340000, igst: 51831, cgst: 0, sgst: 0, particulars: "Raw Materials" },
  { date: "20240829", supplier: "Disha Travel & Tours", voucherNo: "PV-DTT-029", refNo: "DTT/INV/0892", refDate: "20240824", narration: "Business travel Mumbai Aug", grossTotal: 42000, igst: 6403, cgst: 0, sgst: 0, particulars: "Travel" },
  { date: "20240830", supplier: "BrightMinds Consulting LLP", voucherNo: "PV-BM-030", refNo: "BM-2024-1195", refDate: "20240825", narration: "SAP implementation Phase 2 milestone 2", grossTotal: 177000, igst: 26983, cgst: 0, sgst: 0, particulars: "Professional Services" },
];

function formatDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function voucherToXml(v: MockVoucher): string {
  const taxableValue = v.grossTotal - v.igst - v.cgst - v.sgst;
  const ledgerEntries: string[] = [];

  ledgerEntries.push(`
        <LEDGERENTRIES.LIST>
          <LEDGERNAME>${v.supplier}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>-${v.grossTotal}</AMOUNT>
        </LEDGERENTRIES.LIST>`);

  ledgerEntries.push(`
        <LEDGERENTRIES.LIST>
          <LEDGERNAME>${v.particulars}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${taxableValue}</AMOUNT>
        </LEDGERENTRIES.LIST>`);

  if (v.igst > 0) {
    ledgerEntries.push(`
        <LEDGERENTRIES.LIST>
          <LEDGERNAME>IGST Input</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${v.igst}</AMOUNT>
        </LEDGERENTRIES.LIST>`);
  }
  if (v.cgst > 0) {
    ledgerEntries.push(`
        <LEDGERENTRIES.LIST>
          <LEDGERNAME>CGST Input</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${v.cgst}</AMOUNT>
        </LEDGERENTRIES.LIST>`);
  }
  if (v.sgst > 0) {
    ledgerEntries.push(`
        <LEDGERENTRIES.LIST>
          <LEDGERNAME>SGST Input</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${v.sgst}</AMOUNT>
        </LEDGERENTRIES.LIST>`);
  }

  return `
      <VOUCHER>
        <DATE>${v.date}</DATE>
        <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
        <VOUCHERNUMBER>${v.voucherNo}</VOUCHERNUMBER>
        <REFERENCE>${v.refNo}</REFERENCE>
        <REFERENCEDATE>${v.refDate}</REFERENCEDATE>
        <PARTYLEDGERNAME>${v.supplier}</PARTYLEDGERNAME>
        <NARRATION>${v.narration}</NARRATION>
        <EFFECTIVEDATE>${formatDate(v.date)}</EFFECTIVEDATE>
        <AMOUNT>-${v.grossTotal}</AMOUNT>${ledgerEntries.join("")}
      </VOUCHER>`;
}

function purchaseVouchersXml(): string {
  const vouchers = MOCK_VOUCHERS.map(voucherToXml).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <STATUS>1</STATUS>
  </HEADER>
  <BODY>
    <DATA>
      <TALLYMESSAGE>
${vouchers}
      </TALLYMESSAGE>
    </DATA>
  </BODY>
</ENVELOPE>`;
}

function errorXml(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <STATUS>0</STATUS>
  </HEADER>
  <BODY>
    <DATA>
      <LINEERROR>${message}</LINEERROR>
    </DATA>
  </BODY>
</ENVELOPE>`;
}

export function startMockTallyServer(): void {
  const server = createServer((req, res) => {
    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "text/xml" });
      res.end(errorXml("Only POST requests are supported"));
      return;
    }

    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "text/xml" });

      const upper = body.toUpperCase();

      if (
        upper.includes("LIST OF COMPANIES") ||
        upper.includes("COMPANY") && upper.includes("COLLECTION")
      ) {
        res.end(companyListXml());
        return;
      }

      if (upper.includes("PURCHASE") || upper.includes("VOUCHER REGISTER") || upper.includes("DAY BOOK")) {
        res.end(purchaseVouchersXml());
        return;
      }

      res.end(errorXml("Unknown request type"));
    });
  });

  server.listen(MOCK_TALLY_PORT, () => {
    console.log(`Mock TallyPrime server running on port ${MOCK_TALLY_PORT}`);
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.warn(
        `Port ${MOCK_TALLY_PORT} already in use — mock Tally server not started (real Tally may be running)`
      );
    } else {
      console.error("Mock Tally server error:", err);
    }
  });
}

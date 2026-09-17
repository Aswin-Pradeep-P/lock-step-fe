import Papa from "papaparse";

/** A best-effort preview of the first few rows, for the upload screen only — the
 * authoritative parse (column resolution, multi-row headers, everything) happens
 * server-side in lock-step-be once the raw file is uploaded. CSV only: an Excel
 * preview would need a client-side xlsx dependency the app does not ship. */
export async function getPreviewRows(file: File): Promise<Record<string, unknown>[]> {
  if (!file.name.toLowerCase().endsWith(".csv")) return [];
  const text = await file.text();
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      preview: 5,
      complete: (results) => resolve(results.data as Record<string, unknown>[]),
      error: reject,
    });
  });
}

export const getCsvPreviewRows = getPreviewRows;

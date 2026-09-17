import Papa from "papaparse";

/** A best-effort preview of the first few rows, for the upload screen only — the
 * authoritative parse (column resolution, multi-row headers, everything) happens
 * server-side in lock-step-be once the raw file is uploaded. CSV only: an Excel
 * preview would need to reimplement the same header-detection logic the backend
 * already owns, just to throw the result away once the real upload runs. */
export async function getCsvPreviewRows(file: File): Promise<Record<string, unknown>[]> {
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

/** Parse all rows from a CSV (not just preview). */
function parseCsvFull(text: string): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data as Record<string, unknown>[]),
      error: reject,
    });
  });
}

/** Merge multiple CSV/XLSX files into a single CSV File for upload.
 * CSVs are parsed and concatenated with a union of all headers.
 * XLSX files cannot be easily merged client-side — if only XLSX files are present,
 * the first one is returned as-is. */
export async function mergeFiles(files: File[]): Promise<File> {
  if (files.length === 0) throw new Error("No files to merge");
  if (files.length === 1) return files[0];

  const csvFiles = files.filter((f) => f.name.toLowerCase().endsWith(".csv"));
  const xlsxFiles = files.filter((f) => !f.name.toLowerCase().endsWith(".csv"));

  if (csvFiles.length === 0) return xlsxFiles[0];

  const allRows: Record<string, unknown>[] = [];
  const allHeaders = new Set<string>();

  for (const file of csvFiles) {
    const text = await file.text();
    const rows = await parseCsvFull(text);
    for (const row of rows) {
      for (const key of Object.keys(row)) allHeaders.add(key);
    }
    allRows.push(...rows);
  }

  const headers = [...allHeaders];
  const csvLines = [headers.join(",")];
  for (const row of allRows) {
    csvLines.push(
      headers
        .map((h) => {
          const val = String(row[h] ?? "");
          return val.includes(",") || val.includes('"')
            ? `"${val.replace(/"/g, '""')}"`
            : val;
        })
        .join(","),
    );
  }

  return new File([csvLines.join("\n")], "merged_upload.csv", { type: "text/csv" });
}

/** Get preview rows from multiple files, merged together. */
export async function getMultiFilePreviewRows(
  files: File[],
): Promise<Record<string, unknown>[]> {
  const allPreviews: Record<string, unknown>[] = [];
  for (const file of files) {
    const rows = await getCsvPreviewRows(file);
    allPreviews.push(...rows);
  }
  return allPreviews.slice(0, 10);
}

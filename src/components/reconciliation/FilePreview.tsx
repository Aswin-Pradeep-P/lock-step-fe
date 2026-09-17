import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FilePreviewProps {
  rows: Record<string, unknown>[];
  title: string;
}

/** Cap columns so a very wide export can't blow out the layout — but high enough
 *  that a normal ledger / GSTR-2B row (≈8–10 cols) shows in full at page width
 *  with no horizontal scroll. Anything beyond is summarised as "+N cols". */
const MAX_COLS = 12;

export function FilePreview({ rows, title }: FilePreviewProps) {
  if (rows.length === 0) return null;

  const allKeys = Object.keys(rows[0]);
  const columns = allKeys.slice(0, MAX_COLS);
  const extraCols = allKeys.length - columns.length;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title} — Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {/* overflow-x-auto is a safety net for pathologically wide files; for a
            normal export at full page width the table fits with no scroll. */}
        <div className="overflow-x-auto">
          {/* Explicit, matched padding on head and body — the base TableHead is
              h-12 (48px) while body cells are shorter, which reads as two different
              table styles. Same values here keep every preview table consistent. */}
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead
                    key={col}
                    className="h-auto px-3 py-2.5 text-xs font-medium whitespace-nowrap"
                  >
                    {col}
                  </TableHead>
                ))}
                {extraCols > 0 && (
                  <TableHead className="h-auto px-3 py-2.5 text-xs font-medium">
                    +{extraCols} cols
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col} className="px-3 py-2.5 text-xs whitespace-nowrap">
                      {String(row[col] ?? "")}
                    </TableCell>
                  ))}
                  {extraCols > 0 && (
                    <TableCell className="px-3 py-2.5 text-xs text-muted-foreground">…</TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

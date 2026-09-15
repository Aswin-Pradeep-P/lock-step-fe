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

export function FilePreview({ rows, title }: FilePreviewProps) {
  if (rows.length === 0) return null;

  const columns = Object.keys(rows[0]).slice(0, 6);

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title} — Preview (first {rows.length} rows)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col} className="text-xs whitespace-nowrap">
                    {col}
                  </TableHead>
                ))}
                {Object.keys(rows[0]).length > 6 && (
                  <TableHead className="text-xs">...</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col} className="text-xs py-2 whitespace-nowrap">
                      {String(row[col] ?? "")}
                    </TableCell>
                  ))}
                  {Object.keys(rows[0]).length > 6 && (
                    <TableCell className="text-xs text-muted-foreground">
                      +{Object.keys(rows[0]).length - 6} cols
                    </TableCell>
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

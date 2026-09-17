import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { VendorRisk } from "@/types";
import { Users, ShieldQuestion } from "lucide-react";

interface VendorRiskListProps {
  vendors: VendorRisk[];
}

function riskBadgeVariant(band: VendorRisk["risk_band"]) {
  switch (band) {
    case "LOW":
      return "success" as const;
    case "MEDIUM":
      return "warning" as const;
    case "HIGH":
      return "danger" as const;
    case "UNKNOWN":
      return "secondary" as const;
  }
}

function riskLabel(band: VendorRisk["risk_band"]) {
  switch (band) {
    case "LOW":
      return "Reliable";
    case "MEDIUM":
      return "Watch";
    case "HIGH":
      return "High Risk";
    case "UNKNOWN":
      return "No History";
  }
}

export function VendorRiskList({ vendors }: VendorRiskListProps) {
  const navigate = useNavigate();
  const sorted = [...vendors].sort(
    (a, b) => Number(b.current_exposure) - Number(a.current_exposure),
  );

  if (vendors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Vendor Risk</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Users className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">No vendor data available.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Vendor Risk</CardTitle>
        <button
          onClick={() => navigate("/vendors")}
          className="text-xs font-medium text-primary hover:underline"
        >
          View all
        </button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead className="text-center">On-Time Rate</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Exposure</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.slice(0, 5).map((vendor) => (
              <TableRow key={vendor.vendor_id}>
                <TableCell className="font-medium">{vendor.name}</TableCell>
                <TableCell className="font-mono text-xs">
                  {vendor.gstin ?? (
                    <span
                      className="flex items-center gap-1 text-muted-foreground italic"
                      title="No GSTIN could be resolved for this vendor"
                    >
                      <ShieldQuestion className="h-3 w-3" />
                      unverified
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-center text-xs">
                  {vendor.on_time_rate !== null
                    ? `${Math.round(vendor.on_time_rate * 100)}%`
                    : "—"}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={riskBadgeVariant(vendor.risk_band)}>
                    {riskLabel(vendor.risk_band)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-sm font-medium">
                  {formatCurrency(Number(vendor.current_exposure))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

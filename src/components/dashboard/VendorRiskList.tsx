import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Vendor } from "@/types";
import { Users } from "lucide-react";

interface VendorRiskListProps {
  vendors: Vendor[];
}

function riskBadgeVariant(tier: Vendor["riskTier"]) {
  switch (tier) {
    case "green":
      return "success" as const;
    case "amber":
      return "warning" as const;
    case "red":
      return "danger" as const;
  }
}

function riskTierLabel(tier: Vendor["riskTier"]) {
  switch (tier) {
    case "green":
      return "Compliant";
    case "amber":
      return "Late Filer";
    case "red":
      return "Non-Compliant";
  }
}

export function VendorRiskList({ vendors }: VendorRiskListProps) {
  const sorted = [...vendors].sort((a, b) => b.riskScore - a.riskScore);

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
      <CardHeader>
        <CardTitle className="text-lg">Vendor Risk</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead className="text-center">Risk Score</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Missed</TableHead>
              <TableHead>Last Filed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((vendor) => (
              <TableRow key={vendor.id}>
                <TableCell className="font-medium">{vendor.name}</TableCell>
                <TableCell className="font-mono text-xs">
                  {vendor.gstin}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          vendor.riskScore > 70
                            ? "bg-risk-critical"
                            : vendor.riskScore > 30
                            ? "bg-risk-high"
                            : "bg-risk-low"
                        }`}
                        style={{ width: `${vendor.riskScore}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono w-8">
                      {vendor.riskScore}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={riskBadgeVariant(vendor.riskTier)}>
                    {riskTierLabel(vendor.riskTier)}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {vendor.missedFilings > 0 ? (
                    <span className="text-risk-critical font-medium">
                      {vendor.missedFilings}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {vendor.lastFilingDate}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

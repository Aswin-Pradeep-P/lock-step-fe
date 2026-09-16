/**
 * Compliance Trends — the original chart, now drawn from real periods instead of a
 * hardcoded array. Same three series, same styling.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTaxPeriodShort } from "@/lib/format";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TrendPoint {
  taxPeriod: string;
  matchRate: number;
  vendorCompliance: number;
  itcAtRisk: number; // in lakh
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  const points = data.map((p) => ({ ...p, month: formatTaxPeriodShort(p.taxPeriod) }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Compliance Trends</CardTitle>
      </CardHeader>
      <CardContent>
        {points.length < 2 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Reconcile a second period to see the trend.
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={points}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                    fontSize: "12px",
                  }}
                  formatter={(value, name) =>
                    name === "ITC at Risk (₹L)"
                      ? [`₹${value}L`, name]
                      : [`${value}%`, name]
                  }
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                />
                <Line
                  type="monotone"
                  dataKey="matchRate"
                  stroke="hsl(142, 71%, 45%)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  name="Match Rate"
                />
                <Line
                  type="monotone"
                  dataKey="vendorCompliance"
                  stroke="hsl(221, 83%, 53%)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  name="Vendor Compliance"
                  strokeDasharray="5 5"
                />
                <Line
                  type="monotone"
                  dataKey="itcAtRisk"
                  stroke="hsl(0, 84%, 60%)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  name="ITC at Risk (₹L)"
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Vendor compliance is the share of suppliers who filed before the 13th.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

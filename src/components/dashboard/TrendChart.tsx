import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { Headline, Period } from "@/types";
import { matchRatePercent } from "@/lib/risk";

interface TrendChartProps {
  headlines: { period: Period; headline: Headline }[];
}

function formatPeriodLabel(taxPeriod: string): string {
  const month = Number(taxPeriod.slice(0, 2));
  const year = taxPeriod.slice(2);
  const names = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${names[month - 1]} '${year.slice(2)}`;
}

export function TrendChart({ headlines }: TrendChartProps) {
  const data = [...headlines]
    .sort((a, b) => a.period.tax_period.localeCompare(b.period.tax_period))
    .map((h) => ({
      period: formatPeriodLabel(h.period.tax_period),
      matchRate: matchRatePercent(h.headline),
      itcAtRiskLakh: Number(h.headline.amount_at_risk) / 100_000,
    }));

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Compliance Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-8 text-center">
            Run a reconciliation to see trends here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Compliance Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                fontSize: "12px",
              }}
              formatter={(value, name) => {
                const num = Number(value);
                if (name === "ITC at Risk (₹L)") return [`₹${num.toFixed(1)}L`, name];
                return [`${num}%`, name];
              }}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
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
              dataKey="itcAtRiskLakh"
              stroke="hsl(0, 84%, 60%)"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              name="ITC at Risk (₹L)"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

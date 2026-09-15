import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

const TREND_DATA = [
  { month: "Mar '24", matchRate: 62, itcAtRisk: 8.4, vendorCompliance: 54 },
  { month: "Apr '24", matchRate: 68, itcAtRisk: 6.9, vendorCompliance: 58 },
  { month: "May '24", matchRate: 71, itcAtRisk: 5.8, vendorCompliance: 63 },
  { month: "Jun '24", matchRate: 75, itcAtRisk: 4.2, vendorCompliance: 70 },
  { month: "Jul '24", matchRate: 82, itcAtRisk: 3.1, vendorCompliance: 76 },
  { month: "Aug '24", matchRate: 88, itcAtRisk: 2.3, vendorCompliance: 81 },
  { month: "Sep '24", matchRate: 94, itcAtRisk: 1.1, vendorCompliance: 89 },
];

export function TrendChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Compliance Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={TREND_DATA}>
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
              formatter={(value: number, name: string) => {
                if (name === "ITC at Risk (₹L)") return [`₹${value}L`, name];
                return [`${value}%`, name];
              }}
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
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Match rate improved 62% → 94% since Lockstep adoption
        </p>
      </CardContent>
    </Card>
  );
}

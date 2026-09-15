import {
  useState,
  useHostTheme,
  Stack,
  Row,
  Grid,
  H1,
  H2,
  H3,
  Text,
  Card,
  CardHeader,
  CardBody,
  Callout,
  Pill,
  Stat,
  Divider,
  Table,
  BarChart,
  PieChart,
  type CSSProperties,
} from "cursor/canvas";

// ─── Data ────────────────────────────────────────────────────────────────

const SCORES = {
  problemStatement: 9,
  marketOpportunity: 8,
  technicalExecution: 7,
  uxDesign: 7.5,
  differentiation: 9,
  scalability: 6,
  businessModel: 8,
  presentation: 8.5,
};

const MAX = 10;
const overall =
  Object.values(SCORES).reduce((a, b) => a + b, 0) /
  Object.values(SCORES).length;

const marketImprovements = [
  {
    id: "tally-integration",
    title: "Direct Tally / Zoho Books Integration",
    impact: "High",
    effort: "Medium",
    detail:
      "90%+ of Indian SMEs use Tally. A one-click sync via Tally Prime API (or Zoho Books OAuth) removes the manual CSV export step entirely. This is the single highest-leverage feature for adoption.",
  },
  {
    id: "gst-portal-fetch",
    title: "Auto-Fetch GSTR-2B from GST Portal",
    impact: "High",
    effort: "High",
    detail:
      "Use the GSTN Suvidha Provider (GSP) API or scrape the portal with ASP tokens to auto-pull GSTR-2B. Eliminates the second manual upload. ClearTax, Cygnet already do this\u200a\u2014\u200aparity is table stakes.",
  },
  {
    id: "multi-tenant",
    title: "Multi-Entity / CA Practice Portal",
    impact: "High",
    effort: "Medium",
    detail:
      "CAs and tax firms manage 50\u2013500 clients. A multi-tenant dashboard with per-client views, consolidated risk, and bulk reconciliation turns one user into 200 GSTINs. This is the enterprise unlock.",
  },
  {
    id: "regional-lang",
    title: "Regional Language Support (Hindi, Tamil, etc.)",
    impact: "Medium",
    effort: "Low",
    detail:
      "India has 22 official languages. Even Hindi + top-4 regional languages covers 85% of GST filers. i18n with react-intl is straightforward and dramatically widens SME accessibility.",
  },
  {
    id: "mobile-pwa",
    title: "Mobile-First PWA / WhatsApp Bot",
    impact: "Medium",
    effort: "Medium",
    detail:
      "Small business owners live on WhatsApp, not desktop browsers. A PWA with push notifications, or a WhatsApp bot that sends weekly risk summaries and filing reminders, meets users where they are.",
  },
  {
    id: "pricing-freemium",
    title: "Freemium Tier with Viral Loop",
    impact: "High",
    effort: "Low",
    detail:
      "Offer free reconciliation for up to 100 invoices/month. Paid at scale. The free tier creates word-of-mouth in CA circles. Add a 'Powered by Lockstep' watermark on exported reports for organic growth.",
  },
];

const features = [
  {
    id: "payment-hold",
    category: "Core Differentiator",
    title: "Payment Hold Workflow (Your Pitch's Killer Feature)",
    priority: "P0 \u2014 Ship for Demo",
    detail:
      "Your pitch says 'we touch the money' and put payments on a clock. But the current app has zero payment integration. Build at minimum a mock workflow: flag a red invoice \u2192 auto-generate a vendor notification email \u2192 show a payment-hold timer (45-day MSME / 180-day ITC deadline). Without this, the demo contradicts the pitch.",
  },
  {
    id: "vendor-comms",
    category: "Core Differentiator",
    title: "Vendor Communication & Nudge System",
    priority: "P0 \u2014 Ship for Demo",
    detail:
      "When a high-risk mismatch is found, auto-send a templated email/WhatsApp to the vendor: 'Invoice INV-2024-045 is missing from your GSTR-1. Please file by [date] or payment will be held.' Show sent/read/resolved status in the UI. This is the enforcement loop that makes Lockstep different from every matcher.",
  },
  {
    id: "trend-analytics",
    category: "Analytics",
    title: "Trend Dashboard & Month-over-Month Comparison",
    priority: "P1",
    detail:
      "Show match rate trends over time, vendor compliance improvement, and ITC-at-risk trajectory. Judges love data stories. A line chart showing 'Match rate improved 78% \u2192 94% over 3 months' tells a compelling adoption story.",
  },
  {
    id: "ai-suggestions",
    category: "AI / Intelligence",
    title: "AI-Powered Resolution Suggestions",
    priority: "P1",
    detail:
      "Beyond the AI summary, suggest concrete actions: 'This looks like an invoice number typo (INV-045 vs INV-45). Auto-correct and re-match?' or 'Vendor has not filed for 3 months. Consider switching to alternate supplier XYZ who has 98% compliance.' Make the AI actionable, not just descriptive.",
  },
  {
    id: "bulk-actions",
    category: "UX",
    title: "Bulk Actions on Records",
    priority: "P1",
    detail:
      "Select multiple records \u2192 bulk approve, bulk flag, bulk escalate. Tax teams process hundreds of invoices. Row-by-row actions don't scale. Add checkboxes + a floating action bar.",
  },
  {
    id: "audit-trail",
    category: "Compliance",
    title: "Audit Trail & Compliance Report",
    priority: "P1",
    detail:
      "Generate a signed PDF report for each reconciliation: timestamp, who ran it, what was matched, what was flagged. Auditors and internal compliance teams need this. It's also a strong enterprise selling point.",
  },
  {
    id: "rule-engine",
    category: "Configuration",
    title: "Configurable Matching Rules",
    priority: "P2",
    detail:
      "Let users adjust tolerance thresholds (e.g., \u20b95 instead of \u20b91), fuzzy match sensitivity, and ITC classification rules. Different industries have different needs. A rule editor shows product maturity.",
  },
  {
    id: "notifications",
    category: "UX",
    title: "Filing Deadline Alerts & Calendar Integration",
    priority: "P2",
    detail:
      "GSTR-3B is due on the 20th every month. Auto-remind users 5 days before. Show a countdown on the dashboard. Integrate with Google Calendar. Small feature, huge stickiness.",
  },
  {
    id: "api-first",
    category: "Technical",
    title: "Public REST API for ERP Integrations",
    priority: "P2",
    detail:
      "Expose the reconciliation engine as an API. Let ERPs, accounting tools, and CAs plug in programmatically. This is the platform play \u2014 Lockstep becomes infrastructure, not just a UI.",
  },
  {
    id: "dark-mode",
    category: "UX",
    title: "Dark Mode & Accessibility (WCAG 2.1 AA)",
    priority: "P2",
    detail:
      "CAs work late nights during filing season. Dark mode is not cosmetic \u2014 it's practical. WCAG compliance (keyboard nav, screen reader, contrast) opens up government and enterprise procurement.",
  },
];

const techDebt = [
  { area: "Backend", item: "Replace mock Express with a real database (PostgreSQL + Prisma)", priority: "Before launch" },
  { area: "Auth", item: "Add authentication (JWT + refresh tokens) and role-based access", priority: "Before launch" },
  { area: "Security", item: "Rate limiting, CORS lockdown, input sanitization, CSRF protection", priority: "Before launch" },
  { area: "Infra", item: "Containerize with Docker, add CI/CD pipeline (GitHub Actions)", priority: "Week 1" },
  { area: "Testing", item: "Unit tests for reconciler, E2E tests for upload \u2192 results flow", priority: "Week 1" },
  { area: "Performance", item: "Virtualize RecordTable for 10k+ rows (react-window)", priority: "Week 2" },
  { area: "Monitoring", item: "Error tracking (Sentry), usage analytics (PostHog/Mixpanel)", priority: "Week 2" },
];

// ─── Component ───────────────────────────────────────────────────────────

export default function HackathonJudgeReview() {
  const t = useHostTheme();
  const [activeTab, setActiveTab] = useState<"market" | "features" | "tech">(
    "market"
  );

  const accent: CSSProperties = { color: t.accent.primary };
  const muted: CSSProperties = { color: t.text.tertiary };
  const sectionGap = 20;

  return (
    <Stack gap={28} style={{ maxWidth: 860 }}>
      {/* ── Header ── */}
      <Stack gap={6}>
        <Text size="small" weight="medium" style={accent}>
          HACKATHON JUDGE REVIEW
        </Text>
        <H1>Lockstep \u2014 GST Reconciliation Platform</H1>
        <Text tone="secondary">
          Comprehensive evaluation covering market positioning, feature gaps,
          technical readiness, and actionable recommendations to win.
        </Text>
      </Stack>

      {/* ── Overall Score ── */}
      <Grid columns={4} gap={12}>
        <Stat
          value={overall.toFixed(1)}
          label="Overall Score / 10"
          tone="info"
        />
        <Stat
          value={`${SCORES.differentiation}/10`}
          label="Differentiation"
          tone="success"
        />
        <Stat
          value={`${SCORES.scalability}/10`}
          label="Scalability"
          tone="warning"
        />
        <Stat
          value={`${SCORES.technicalExecution}/10`}
          label="Tech Execution"
          tone="info"
        />
      </Grid>

      <BarChart
        categories={[
          "Problem",
          "Market",
          "Tech",
          "UX",
          "Differentiation",
          "Scalability",
          "Business",
          "Pitch",
        ]}
        series={[
          {
            name: "Score",
            data: Object.values(SCORES),
          },
        ]}
        height={180}
        valueSuffix="/10"
        referenceLines={[
          { value: overall, label: `Avg ${overall.toFixed(1)}`, tone: "info" },
        ]}
        yMax={10}
      />

      {/* ── Verdict ── */}
      <Callout tone="success" title="Verdict: Strong Concept, Needs the Killer Demo">
        The problem is real, urgent, and well-articulated. Rule 88D is a perfect
        regulatory tailwind. Your wedge ("we touch the money") is genuinely
        unique in the market. But the current prototype only demonstrates the
        table-stakes matching that every competitor already does. To win, you
        need to demo the payment-hold workflow that makes your pitch true.
      </Callout>

      <Divider />

      {/* ── Tab Nav ── */}
      <Row gap={8}>
        <Pill
          active={activeTab === "market"}
          onClick={() => setActiveTab("market")}
        >
          Market Reach
        </Pill>
        <Pill
          active={activeTab === "features"}
          onClick={() => setActiveTab("features")}
        >
          Feature Roadmap
        </Pill>
        <Pill
          active={activeTab === "tech"}
          onClick={() => setActiveTab("tech")}
        >
          Technical Gaps
        </Pill>
      </Row>

      {/* ── Market Reach ── */}
      {activeTab === "market" && (
        <Stack gap={sectionGap}>
          <H2>Improvements to Reach More Market</H2>
          <Text tone="secondary">
            Six strategic moves ranked by impact. The current app requires two
            manual CSV uploads\u200a\u2014\u200athat alone kills adoption for 80% of the TAM.
            Fix the onboarding friction first, then expand reach.
          </Text>

          <PieChart
            data={[
              { label: "Tally Users (SME)", value: 50, tone: "info" },
              { label: "Zoho / Other Cloud", value: 20 },
              { label: "CA Firms (Multi-client)", value: 20 },
              { label: "Enterprise (SAP/Oracle)", value: 10 },
            ]}
            donut
            size={180}
          />
          <Text size="small" tone="tertiary">
            Target market composition \u2014 India GST filers by accounting tool
          </Text>

          {marketImprovements.map((item) => (
            <Card key={item.id} collapsible defaultOpen={false}>
              <CardHeader
                trailing={
                  <Row gap={4}>
                    <Pill size="sm" active={item.impact === "High"}>
                      {item.impact} Impact
                    </Pill>
                    <Pill size="sm">{item.effort} Effort</Pill>
                  </Row>
                }
              >
                {item.title}
              </CardHeader>
              <CardBody>
                <Text tone="secondary">{item.detail}</Text>
              </CardBody>
            </Card>
          ))}
        </Stack>
      )}

      {/* ── Features ── */}
      {activeTab === "features" && (
        <Stack gap={sectionGap}>
          <H2>Feature Roadmap</H2>

          <Callout tone="danger" title="Gap Alert: The Pitch vs The Product">
            Your pitch promises "we touch the money" and "put payments on the
            clock." The current app has zero payment workflow. This is the #1
            thing a judge will notice. Ship at least a mock payment-hold flow
            before the demo.
          </Callout>

          <H3>P0 \u2014 Must Ship for Demo Day</H3>
          {features
            .filter((f) => f.priority.startsWith("P0"))
            .map((f) => (
              <Card key={f.id} collapsible defaultOpen>
                <CardHeader trailing={<Pill size="sm" active>{f.category}</Pill>}>
                  {f.title}
                </CardHeader>
                <CardBody>
                  <Text tone="secondary">{f.detail}</Text>
                </CardBody>
              </Card>
            ))}

          <H3>P1 \u2014 Strong Differentiators</H3>
          {features
            .filter((f) => f.priority.startsWith("P1"))
            .map((f) => (
              <Card key={f.id} collapsible defaultOpen={false}>
                <CardHeader trailing={<Pill size="sm">{f.category}</Pill>}>
                  {f.title}
                </CardHeader>
                <CardBody>
                  <Text tone="secondary">{f.detail}</Text>
                </CardBody>
              </Card>
            ))}

          <H3>P2 \u2014 Nice to Have / Post-Hackathon</H3>
          {features
            .filter((f) => f.priority.startsWith("P2"))
            .map((f) => (
              <Card key={f.id} collapsible defaultOpen={false}>
                <CardHeader trailing={<Pill size="sm">{f.category}</Pill>}>
                  {f.title}
                </CardHeader>
                <CardBody>
                  <Text tone="secondary">{f.detail}</Text>
                </CardBody>
              </Card>
            ))}
        </Stack>
      )}

      {/* ── Tech Gaps ── */}
      {activeTab === "tech" && (
        <Stack gap={sectionGap}>
          <H2>Technical Gaps & Production Readiness</H2>
          <Text tone="secondary">
            The current stack (React + Vite + Express mock) is solid for a
            hackathon prototype. These are the gaps between "demo" and "product."
          </Text>

          <Table
            headers={["Area", "Action Item", "When"]}
            rows={techDebt.map((d) => [d.area, d.item, d.priority])}
            columnAlign={["left", "left", "left"]}
            striped
          />

          <H3>Architecture Recommendation</H3>
          <Callout tone="info" title="Suggested Production Stack">
            Next.js (SSR for SEO + API routes) or keep Vite SPA + separate
            Node/Fastify backend. PostgreSQL with Prisma ORM. Redis for
            job queues (reconciliation can be async for large files).
            Supabase or Clerk for auth. Vercel or Railway for hosting.
            Bull/BullMQ for background reconciliation jobs.
          </Callout>

          <H3>Competitive Landscape</H3>
          <Table
            headers={["Feature", "ClearTax", "Cygnet", "IRIS", "Lockstep"]}
            rows={[
              ["3-Pass Matching", "Yes", "Yes", "Yes", "Yes"],
              ["GSTR-2B Auto-Fetch", "Yes", "Yes", "Yes", "No"],
              ["Tally Integration", "Yes", "Yes", "No", "No"],
              ["Payment Hold", "No", "No", "No", "Pitched"],
              ["Vendor Nudging", "No", "No", "No", "Pitched"],
              ["Multi-Entity", "Yes", "Yes", "Yes", "No"],
              ["Audit Reports", "Yes", "Yes", "Yes", "No"],
              ["Pricing", "\u20b918k/yr+", "\u20b912k/yr+", "\u20b915k/yr+", "TBD"],
            ]}
            columnAlign={["left", "center", "center", "center", "center"]}
            rowTone={[
              "neutral",
              "danger",
              "danger",
              "success",
              "success",
              "danger",
              "danger",
              undefined,
            ]}
            striped
          />
          <Text size="small" tone="tertiary">
            Red = competitive gap Lockstep must close. Green = unique advantage
            to double down on.
          </Text>
        </Stack>
      )}

      <Divider />

      {/* ── Final Recommendations ── */}
      <Stack gap={12}>
        <H2>Top 5 Recommendations to Win</H2>
        <Table
          headers={["#", "Action", "Why It Matters"]}
          rows={[
            [
              "1",
              "Build the payment-hold workflow (even mocked)",
              "Your entire pitch rests on this. Without it, you're 'just another matcher.' With it, you're the only product in the market that touches money.",
            ],
            [
              "2",
              "Add vendor notification system",
              "The enforcement loop (detect \u2192 notify \u2192 hold \u2192 resolve) is your moat. Show the full cycle, not just detection.",
            ],
            [
              "3",
              "Show a trend chart on the dashboard",
              "Judges respond to data stories. A chart showing compliance improving over time proves the product works, not just runs.",
            ],
            [
              "4",
              "Add Tally API integration (even read-only)",
              "Removes the biggest adoption friction. Even a 'Connect Tally' button that imports data via Tally Prime API is a game-changer for the demo.",
            ],
            [
              "5",
              "Generate a PDF compliance report",
              "Shows enterprise readiness. Auditors need paper trails. A 'Download Audit Report' button is 20 lines of code (jsPDF) and massive perceived value.",
            ],
          ]}
          columnAlign={["center", "left", "left"]}
        />
      </Stack>

      <Callout tone="warning" title="The Judge's Honest Take">
        You've nailed the hardest part: finding a real, painful problem with
        regulatory urgency. The pitch is sharp. The matching engine works. But
        right now, the product demo proves you can do what ClearTax already
        does\u200a\u2014\u200anot what makes you different. Spend the next sprint building the
        payment-hold and vendor-nudge flows. That's what turns "interesting idea"
        into "take my money."
      </Callout>
    </Stack>
  );
}

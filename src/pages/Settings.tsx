/**
 * Approval thresholds, editable live.
 *
 * "What would make someone trust an automated payment hold?" is answered by making it
 * configurable rather than hardcoded — and by the audit trail behind every action.
 */

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import * as api from "@/lib/api";
import { formatFullInr } from "@/lib/format";
import type { Thresholds } from "@/types";
import { Check, Loader2 } from "lucide-react";

export default function Settings() {
  const [thresholds, setThresholds] = useState<Thresholds | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.fetchThresholds().then(setThresholds);
  }, []);

  async function save() {
    if (!thresholds) return;
    setSaving(true);
    try {
      setThresholds(await api.saveThresholds(thresholds));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  if (!thresholds) {
    return (
      <div>
        <Header title="Thresholds" />
        <div className="p-6 lg:p-8">Loading…</div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Thresholds" />

      <div className="max-w-2xl space-y-6 p-6 lg:p-8">
        <div>
          <p className="text-sm text-muted-foreground">
            Auto-notify always. Above the first threshold a payment hold is
            proposed; above the second a human has to approve it before it
            applies.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Rupees of tax at risk, per invoice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field
              label="Propose a payment hold above"
              value={thresholds.hold_proposal_threshold}
              onChange={(hold_proposal_threshold) =>
                setThresholds({ ...thresholds, hold_proposal_threshold })
              }
            />
            <Field
              label="Require human approval above"
              value={thresholds.approval_threshold}
              onChange={(approval_threshold) =>
                setThresholds({ ...thresholds, approval_threshold })
              }
            />

            <div className="rounded-md border bg-muted/40 p-4 text-sm">
              <p className="font-medium">With these settings</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>
                  Below {formatFullInr(thresholds.hold_proposal_threshold)} —
                  notify the vendor and keep watching.
                </li>
                <li>
                  {formatFullInr(thresholds.hold_proposal_threshold)} to{" "}
                  {formatFullInr(thresholds.approval_threshold)} — propose a
                  hold automatically.
                </li>
                <li>
                  Above {formatFullInr(thresholds.approval_threshold)} — propose
                  a hold, but a person must sign it off.
                </li>
              </ul>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save thresholds
              </Button>
              {saved && (
                <span className="flex items-center gap-1 text-sm text-risk-low">
                  <Check className="h-4 w-4" /> Saved
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Held in the running API process — they reset when the backend
              restarts.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <Input
        type="number"
        min={0}
        step={1000}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

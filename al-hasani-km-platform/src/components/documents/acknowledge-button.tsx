"use client";
import * as React from "react";
import { CheckCircle2, Check, Loader2 } from "lucide-react";
import { Button, AckBadge } from "@/components/ui";
import type { AckStatus } from "@/lib/types";

export function AcknowledgeButton({
  documentId,
  initial,
}: {
  documentId: string;
  initial: AckStatus;
}) {
  const [status, setStatus] = React.useState<AckStatus>(initial);
  const [loading, setLoading] = React.useState(false);

  async function update(next: "READ" | "ACKNOWLEDGED") {
    setLoading(true);
    try {
      const res = await fetch("/api/compliance/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, action: next }),
      });
      if (res.ok) setStatus(next);
    } finally {
      setLoading(false);
    }
  }

  if (status === "ACKNOWLEDGED") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-ok/30 bg-ok/10 px-4 py-2.5 text-sm font-semibold text-ok">
        <CheckCircle2 className="h-5 w-5" />
        تم إقرارك بهذه الوثيقة
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2 text-xs text-muted">
        <span>حالتك:</span>
        <AckBadge status={status} />
      </div>
      <div className="flex gap-2 sm:ms-auto">
        {status === "VIEWED" || status === "NOT_VIEWED" ? (
          <Button variant="outline" size="sm" onClick={() => update("READ")} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            وضع علامة «قُرئت»
          </Button>
        ) : null}
        <Button size="sm" onClick={() => update("ACKNOWLEDGED")} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          أقرّ بالاطّلاع والالتزام
        </Button>
      </div>
    </div>
  );
}

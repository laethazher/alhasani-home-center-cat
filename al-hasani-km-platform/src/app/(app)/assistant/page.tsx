"use client";
import * as React from "react";
import Link from "next/link";
import { Sparkles, Send, Loader2, FileText, ListChecks, ShieldCheck, User2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui";
import type { Citation } from "@/lib/types";
import { arNum, cn } from "@/lib/utils";

interface Msg {
  role: "USER" | "ASSISTANT";
  content: string;
  citations?: Citation[];
  relatedSops?: { id: string; code: string; title: string }[];
  pending?: boolean;
}

const SUGGESTIONS = [
  "ما خطوات تفعيل المصادقة الثنائية؟",
  "كيف أستلم شحنة أثاث واردة وأفحصها؟",
  "ما سياسة الإجازات والحضور؟",
  "ما إجراءات السلامة عند رفع القطع الثقيلة؟",
];

export default function AssistantPage() {
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "USER", content: text }, { role: "ASSISTANT", content: "", pending: true }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "ASSISTANT",
          content: data.answer ?? data.error ?? "تعذّرت الإجابة.",
          citations: data.citations,
          relatedSops: data.relatedSops,
        };
        return copy;
      });
    } catch {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "ASSISTANT", content: "حدث خطأ في الاتصال. حاول مجدداً." };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="مدعوم بالذكاء الاصطناعي"
        title="المساعد المعرفي"
        description="اسأل بالعربية، وسأجيب من وثائق المجموعة المعتمدة حصراً مع ذكر المصدر ورقم الصفحة."
      />

      <div className="flex min-h-[60vh] flex-col overflow-hidden rounded-2xl border border-line bg-surface">
        {/* Guardrail banner */}
        <div className="flex items-center gap-2 border-b border-line bg-teal-soft/40 px-5 py-2.5 text-2xs text-teal-ink">
          <ShieldCheck className="h-4 w-4" />
          الإجابات مستندة إلى الوثائق المعتمدة فقط — لا معلومات من خارج قاعدة المعرفة.
        </div>

        {/* Thread */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-5 py-12 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-teal-soft text-teal-ink">
                <Sparkles className="h-7 w-7" />
              </div>
              <div>
                <p className="font-display text-base font-bold text-ink">كيف يمكنني مساعدتك؟</p>
                <p className="mt-1 text-xs text-muted">اختر سؤالاً للبدء أو اكتب سؤالك مباشرة.</p>
              </div>
              <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-start text-xs text-ink transition hover:border-teal/40 hover:bg-teal-soft/40">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => <Bubble key={i} msg={m} />)
          )}
          <div ref={endRef} />
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="border-t border-line bg-bg/60 p-3"
        >
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
              }}
              rows={1}
              placeholder="اكتب سؤالك هنا…"
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-faint focus:border-teal"
            />
            <button type="submit" disabled={loading || !input.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal text-white transition hover:brightness-95 disabled:opacity-40">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 -scale-x-100" />}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "USER";
  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "")}>
      <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", isUser ? "bg-ink text-white" : "bg-teal-soft text-teal-ink")}>
        {isUser ? <User2 className="h-[18px] w-[18px]" /> : <Sparkles className="h-[18px] w-[18px]" />}
      </div>
      <div className={cn("min-w-0 max-w-[80%]", isUser ? "items-end" : "")}>
        <div className={cn("rounded-2xl px-4 py-3 text-sm leading-loose", isUser ? "bg-ink text-white" : "bg-surface-2 text-ink")}>
          {msg.pending ? (
            <span className="inline-flex items-center gap-2 text-muted"><Loader2 className="h-4 w-4 animate-spin" /> أبحث في الوثائق المعتمدة…</span>
          ) : (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          )}
        </div>

        {/* Citations */}
        {msg.citations && msg.citations.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <p className="text-2xs font-semibold text-faint">المصادر:</p>
            {msg.citations.map((c, i) => (
              <Link key={i} href={`/documents/${c.documentId}`} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs transition hover:border-teal/40">
                <FileText className="h-4 w-4 shrink-0 text-teal-ink" />
                <span className="min-w-0 flex-1 truncate text-ink">{c.title}</span>
                <span className="shrink-0 font-mono text-2xs text-muted" dir="ltr">{c.documentNumber}</span>
                <Badge tone="muted">صفحة {arNum(c.page)}</Badge>
              </Link>
            ))}
          </div>
        )}

        {/* Related SOPs */}
        {msg.relatedSops && msg.relatedSops.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {msg.relatedSops.map((s) => (
              <Link key={s.id} href={`/sops/${s.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-gold/15 px-2.5 py-1 text-2xs font-medium text-gold transition hover:brightness-110">
                <ListChecks className="h-3.5 w-3.5" /> {s.title}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

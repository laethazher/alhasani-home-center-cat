import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth";
import {
  retrieveContext,
  relatedSops,
  buildContextBlock,
  citationsFrom,
  ASSISTANT_SYSTEM_PROMPT,
} from "@/lib/ai/assistant";

const schema = z.object({
  message: z.string().min(1),
  history: z
    .array(z.object({ role: z.enum(["USER", "ASSISTANT"]), content: z.string() }))
    .optional()
    .default([]),
});

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  const { message, history } = parsed.data;

  // 1) Retrieve grounding passages from the approved corpus (RAG).
  const passages = await retrieveContext(message, user, 5);
  const citations = citationsFrom(passages);
  const sops = relatedSops(passages);
  const contextBlock = buildContextBlock(passages);

  // 2) If no model key is configured, return the grounded sources with a notice.
  if (!env.anthropicKey) {
    return NextResponse.json({
      answer:
        "المساعد المعرفي يعمل في وضع العرض دون مفتاح نموذج. لقد عثرتُ على المقاطع المعتمدة الأكثر صلة بسؤالك أدناه؛ لتفعيل الإجابات الكاملة المولّدة أضِف ANTHROPIC_API_KEY في ملف البيئة.",
      citations,
      relatedSops: sops,
      grounded: passages.length > 0,
    });
  }

  // 3) Call Claude with a strict, source-bound system prompt.
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: env.anthropicKey });

    const messages = [
      ...history.map((h) => ({
        role: h.role === "USER" ? ("user" as const) : ("assistant" as const),
        content: h.content,
      })),
      {
        role: "user" as const,
        content: `سؤال الموظف: ${message}\n\nالمقاطع المعتمدة المتاحة للإجابة:\n\n${contextBlock}\n\nأجب بالاعتماد على هذه المقاطع فقط، واذكر المصدر (رقم الوثيقة وصفحته).`,
      },
    ];

    const resp = await client.messages.create({
      model: env.aiModel,
      max_tokens: 1024,
      system: ASSISTANT_SYSTEM_PROMPT,
      messages,
    });

    const answer = resp.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");

    return NextResponse.json({ answer, citations, relatedSops: sops, grounded: passages.length > 0 });
  } catch (err: any) {
    console.error("[ai/chat] error:", err);
    return NextResponse.json(
      { error: "تعذّر الوصول إلى نموذج الذكاء الاصطناعي حالياً.", citations, relatedSops: sops },
      { status: 502 }
    );
  }
}

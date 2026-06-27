import "server-only";
import { env } from "../env";
import type { Citation, SessionUser } from "../types";
import { searchDocuments } from "../search/searchService";
import { embed, qdrantSearch } from "./embeddings";
import { SAMPLE_DOCUMENTS, SAMPLE_SOPS } from "../data/sampleData";

export interface RetrievedPassage {
  documentId: string;
  documentNumber: string;
  title: string;
  page: number;
  content: string;
}

/**
 * Hybrid retrieval over the approved corpus. In production this fuses
 * Elasticsearch (lexical) + Qdrant (semantic). In demo it uses the lexical
 * search service plus the corpus summaries to ground answers.
 */
export async function retrieveContext(
  query: string,
  user: SessionUser,
  k = 5
): Promise<RetrievedPassage[]> {
  const passages: RetrievedPassage[] = [];

  // Semantic (Qdrant) — active when configured.
  try {
    const vec = await embed(query);
    const filter =
      user.role === "ADMIN"
        ? undefined
        : { must: [{ key: "departmentId", match: { value: user.departmentId } }] };
    const vmatches = await qdrantSearch(env.qdrantCollection, vec, k, filter);
    for (const m of vmatches)
      passages.push({
        documentId: m.payload.documentId,
        documentNumber: m.payload.documentNumber,
        title: m.payload.title,
        page: m.payload.page ?? 1,
        content: m.payload.content ?? "",
      });
  } catch {
    /* fall through to lexical */
  }

  // Lexical fallback / fusion — map top documents to grounding passages.
  if (passages.length < k) {
    const hits = await searchDocuments(query, { semantic: true, limit: k });
    for (const h of hits) {
      if (passages.some((p) => p.documentId === h.id)) continue;
      const doc = SAMPLE_DOCUMENTS.find((d) => d.id === h.id);
      if (!doc || doc.status !== "PUBLISHED") continue;
      passages.push({
        documentId: doc.id,
        documentNumber: doc.documentNumber,
        title: doc.title,
        page: h.page ?? 2,
        content: doc.summary ?? doc.title,
      });
    }
  }
  return passages.slice(0, k);
}

export function relatedSops(passages: RetrievedPassage[]) {
  const docNumbers = new Set(passages.map((p) => p.documentNumber));
  return SAMPLE_SOPS.filter(
    (s) => s.documentNumber && docNumbers.has(s.documentNumber)
  ).map((s) => ({ id: s.id, code: s.code, title: s.title }));
}

export const ASSISTANT_SYSTEM_PROMPT = `أنت "المساعد المعرفي" لمجموعة الحسني. مهمتك الإجابة عن أسئلة الموظفين اعتماداً حصرياً على المقاطع المعتمدة المرفقة من وثائق المجموعة الرسمية.

القواعد الإلزامية:
- لا تجب إلا مما ورد في المقاطع المرفقة. لا تستخدم معرفة عامة من خارجها.
- إذا لم تكفِ المقاطع للإجابة، فاذكر بوضوح أن المعلومة غير متوفرة في الوثائق المعتمدة، واقترح التواصل مع الجهة المالكة.
- استشهد دائماً بمصادرك بصيغة: (المصدر: رقم الوثيقة — صفحة س).
- اكتب بالعربية الفصحى، بإيجاز ووضوح مهني.
- لا تختلق أرقام وثائق أو صفحات أو محتوى غير موجود.
- عند وجود إجراء عمل (SOP) ذي صلة، يمكنك الإشارة إليه في نهاية الإجابة.`;

export function buildContextBlock(passages: RetrievedPassage[]): string {
  if (!passages.length) return "لا توجد مقاطع معتمدة مطابقة لهذا الاستعلام.";
  return passages
    .map(
      (p, i) =>
        `### المقطع ${i + 1}\nالوثيقة: ${p.documentNumber} — «${p.title}» (صفحة ${p.page})\nالمحتوى: ${p.content}`
    )
    .join("\n\n");
}

export function citationsFrom(passages: RetrievedPassage[]): Citation[] {
  return passages.map((p) => ({
    documentId: p.documentId,
    documentNumber: p.documentNumber,
    title: p.title,
    page: p.page,
    snippet: p.content.slice(0, 120),
  }));
}

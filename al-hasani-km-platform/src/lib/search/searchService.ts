import "server-only";
import { env } from "../env";
import type { SearchHit } from "../types";
import { SAMPLE_DOCUMENTS } from "../data/sampleData";

export interface SearchOptions {
  departmentId?: string;
  type?: string;
  semantic?: boolean;
  limit?: number;
}

interface SearchProvider {
  search(query: string, opts: SearchOptions): Promise<SearchHit[]>;
}

// --- light synonym expansion to emulate semantic recall in demo mode -------
const SYNONYMS: Record<string, string[]> = {
  "كلمة المرور": ["كلمات المرور", "باسوورد", "تسجيل الدخول"],
  "أمان": ["أمن المعلومات", "حماية", "مصادقة"],
  "مخزن": ["مستودع", "مخزون", "جرد"],
  "تركيب": ["تثبيت", "موقع العميل"],
  "إجازة": ["الإجازات", "الحضور", "الدوام"],
  "سلامة": ["إصابات", "حماية شخصية", "رفع"],
};

function expand(query: string): string[] {
  const terms = new Set<string>([query]);
  for (const [k, vals] of Object.entries(SYNONYMS)) {
    if (query.includes(k) || vals.some((v) => query.includes(v))) {
      terms.add(k);
      vals.forEach((v) => terms.add(v));
    }
  }
  return Array.from(terms);
}

// --------------------------------------------------------------------------
//  Local provider (demo / fallback) — scores the bundled corpus.
// --------------------------------------------------------------------------
class LocalSearchProvider implements SearchProvider {
  async search(query: string, opts: SearchOptions): Promise<SearchHit[]> {
    const q = query.trim();
    if (!q) return [];
    const terms = opts.semantic ? expand(q) : [q];
    const hits: SearchHit[] = [];

    for (const d of SAMPLE_DOCUMENTS) {
      if (d.status === "DRAFT") continue;
      if (opts.departmentId && opts.departmentId !== "ALL" && d.departmentId !== opts.departmentId) continue;
      if (opts.type && opts.type !== "ALL" && d.type !== opts.type) continue;

      const matchedIn: SearchHit["matchedIn"] = [];
      let score = 0;
      for (const t of terms) {
        const weight = t === q ? 1 : 0.5; // exact term weighted higher
        if (d.title.includes(t)) { score += 5 * weight; if (!matchedIn.includes("title")) matchedIn.push("title"); }
        if (d.documentNumber.includes(t)) { score += 6 * weight; if (!matchedIn.includes("number")) matchedIn.push("number"); }
        if (d.departmentName.includes(t)) { score += 2 * weight; if (!matchedIn.includes("department")) matchedIn.push("department"); }
        if (d.keywords.some((k) => k.includes(t) || t.includes(k))) { score += 4 * weight; if (!matchedIn.includes("keyword")) matchedIn.push("keyword"); }
        if (d.summary?.includes(t)) { score += 3 * weight; if (!matchedIn.includes("content")) matchedIn.push("content"); }
      }
      if (opts.semantic && score > 0 && matchedIn.length && !matchedIn.includes("title") && !matchedIn.includes("number")) {
        matchedIn.push("semantic");
      }
      if (score > 0) {
        const snippet = d.summary
          ? d.summary.slice(0, 160) + (d.summary.length > 160 ? "…" : "")
          : d.title;
        hits.push({
          id: d.id,
          documentNumber: d.documentNumber,
          title: d.title,
          type: d.type,
          departmentName: d.departmentName,
          status: d.status,
          snippet,
          score: Math.round(score * 10) / 10,
          page: matchedIn.includes("content") ? 3 : undefined,
          matchedIn,
        });
      }
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 20);
  }
}

// --------------------------------------------------------------------------
//  Elasticsearch provider (production) — used when ELASTICSEARCH_URL is set.
// --------------------------------------------------------------------------
class ElasticSearchProvider implements SearchProvider {
  async search(query: string, opts: SearchOptions): Promise<SearchHit[]> {
    const { Client } = await import("@elastic/elasticsearch");
    const client = new Client({
      node: env.elasticUrl,
      ...(env.elasticApiKey ? { auth: { apiKey: env.elasticApiKey } } : {}),
    });
    const filter: any[] = [{ terms: { status: ["PUBLISHED", "ARCHIVED", "IN_REVIEW", "EXPIRED"] } }];
    if (opts.departmentId && opts.departmentId !== "ALL")
      filter.push({ term: { departmentId: opts.departmentId } });
    if (opts.type && opts.type !== "ALL") filter.push({ term: { type: opts.type } });

    const res = await client.search({
      index: env.elasticIndex,
      size: opts.limit ?? 20,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query,
                type: "best_fields",
                fields: ["title^4", "documentNumber^5", "keywords^3", "departmentName^2", "ocrText"],
                fuzziness: "AUTO",
              },
            },
          ],
          filter,
        },
      },
      highlight: { fields: { ocrText: {}, title: {} } },
    });

    return (res.hits.hits as any[]).map((h) => ({
      id: h._id,
      documentNumber: h._source.documentNumber,
      title: h._source.title,
      type: h._source.type,
      departmentName: h._source.departmentName,
      status: h._source.status,
      snippet:
        h.highlight?.ocrText?.[0]?.replace(/<\/?em>/g, "") ??
        h._source.summary?.slice(0, 160) ??
        "",
      score: h._score ?? 0,
      matchedIn: ["content"],
    }));
  }
}

function provider(): SearchProvider {
  if (!env.demoMode && env.elasticUrl) return new ElasticSearchProvider();
  return new LocalSearchProvider();
}

export async function searchDocuments(
  query: string,
  opts: SearchOptions = {}
): Promise<SearchHit[]> {
  try {
    return await provider().search(query, opts);
  } catch (err) {
    console.error("[search] provider failed, falling back to local:", err);
    return new LocalSearchProvider().search(query, opts);
  }
}

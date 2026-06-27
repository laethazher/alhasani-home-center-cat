import "server-only";
import { env } from "../env";

/**
 * طبقة تجريد مزوّدي التضمين (Embeddings Provider Abstraction).
 * تُضبط بالكامل عبر متغيّرات البيئة دون أي تعديل في الكود:
 *   EMBEDDINGS_PROVIDER = openai | voyage | ollama | local
 * لإضافة مزوّد مستقبلي: أضِف دالة جديدة وادرجها في الخريطة PROVIDERS.
 */
export type EmbeddingsProvider = "openai" | "voyage" | "ollama" | "gemini" | "local";

// أبعاد المتجهات الافتراضية لكل مزوّد (يجب أن تطابق مجموعة Qdrant).
const PROVIDER_DIMS: Record<EmbeddingsProvider, number> = {
  openai: 1536, // text-embedding-3-small
  voyage: 1024, // voyage-3
  ollama: 768, // nomic-embed-text
  gemini: 768, // text-embedding-004
  local: env.embeddingDim || 1024,
};

export function activeProvider(): EmbeddingsProvider {
  const p = (process.env.EMBEDDINGS_PROVIDER || "local").toLowerCase();
  if (p === "openai" || p === "voyage" || p === "ollama" || p === "gemini") return p;
  return "local";
}

export function embeddingDim(): number {
  if (process.env.EMBEDDING_DIM) return Number(process.env.EMBEDDING_DIM);
  return PROVIDER_DIMS[activeProvider()];
}

// ----------------------------- Providers ---------------------------------
async function openaiEmbed(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      input: text,
      model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
    }),
  });
  if (!res.ok) throw new Error(`OpenAI embeddings failed: ${res.status}`);
  const json = await res.json();
  return json.data[0].embedding as number[];
}

async function voyageEmbed(text: string): Promise<number[]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: text,
      model: process.env.VOYAGE_EMBEDDING_MODEL || "voyage-3",
      input_type: "document",
    }),
  });
  if (!res.ok) throw new Error(`Voyage embeddings failed: ${res.status}`);
  const json = await res.json();
  return json.data[0].embedding as number[];
}

async function ollamaEmbed(text: string): Promise<number[]> {
  const base = process.env.OLLAMA_URL || "http://localhost:11434";
  const res = await fetch(`${base}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text",
      prompt: text,
    }),
  });
  if (!res.ok) throw new Error(`Ollama embeddings failed: ${res.status}`);
  const json = await res.json();
  return json.embedding as number[];
}

// Gemini (يعيد استخدام مفتاح GEMINI_API_KEY الموجود في نظام Home Center).
async function geminiEmbed(text: string): Promise<number[]> {
  const model = process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${env.geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: `models/${model}`, content: { parts: [{ text }] } }),
    }
  );
  if (!res.ok) throw new Error(`Gemini embeddings failed: ${res.status}`);
  const json = await res.json();
  return json.embedding.values as number[];
}

// تضمين محلي حتمي (bag-of-trigrams مُجزّأ) — يعمل بلا إنترنت ولا مفاتيح.
function localEmbed(text: string, dim = embeddingDim()): number[] {
  const v = new Array(dim).fill(0);
  const clean = text.replace(/\s+/g, " ").trim();
  for (let i = 0; i < clean.length - 1; i++) {
    const gram = clean.slice(i, i + 2);
    let h = 2166136261;
    for (let j = 0; j < gram.length; j++) {
      h ^= gram.charCodeAt(j);
      h = Math.imul(h, 16777619);
    }
    v[Math.abs(h) % dim] += 1;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

const PROVIDERS: Record<EmbeddingsProvider, (t: string) => Promise<number[]>> = {
  openai: openaiEmbed,
  voyage: voyageEmbed,
  ollama: ollamaEmbed,
  gemini: geminiEmbed,
  local: async (t) => localEmbed(t),
};

/** الدالة الموحّدة: تختار المزوّد حسب البيئة وتسقط محلياً عند أي خطأ. */
export async function embed(text: string): Promise<number[]> {
  const provider = activeProvider();
  // في وضع العرض نستخدم التضمين المحلي دائماً لضمان التشغيل الفوري.
  if (env.demoMode && provider !== "local") return localEmbed(text);
  try {
    return await PROVIDERS[provider](text);
  } catch (err) {
    console.error(`[embeddings] provider "${provider}" failed, using local:`, err);
    return localEmbed(text);
  }
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map((t) => embed(t)));
}

// --------------------------------------------------------------------------
//  Qdrant (متجر المتجهات)
// --------------------------------------------------------------------------
export interface VectorMatch {
  pointId: string;
  payload: Record<string, any>;
  score: number;
}

export async function qdrantSearch(
  collection: string,
  vector: number[],
  limit = 6,
  filter?: Record<string, any>
): Promise<VectorMatch[]> {
  if (env.demoMode || !env.qdrantUrl) return [];
  const { QdrantClient } = await import("@qdrant/js-client-rest");
  const client = new QdrantClient({ url: env.qdrantUrl, apiKey: env.qdrantApiKey || undefined });
  const result = await client.search(collection, { vector, limit, with_payload: true, filter });
  return result.map((r: any) => ({ pointId: String(r.id), payload: r.payload ?? {}, score: r.score }));
}

export async function ensureQdrantCollection(collection: string, dim = embeddingDim()) {
  if (env.demoMode || !env.qdrantUrl) return;
  const { QdrantClient } = await import("@qdrant/js-client-rest");
  const client = new QdrantClient({ url: env.qdrantUrl, apiKey: env.qdrantApiKey || undefined });
  const exists = await client.collectionExists(collection).catch(() => ({ exists: false }));
  if (!(exists as any).exists) {
    await client.createCollection(collection, { vectors: { size: dim, distance: "Cosine" } });
  }
}

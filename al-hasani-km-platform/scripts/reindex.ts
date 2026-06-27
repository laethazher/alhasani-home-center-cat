/**
 * Reindex pipeline — run after seeding or bulk uploads:
 *   npm run search:index
 *
 * 1) Pull published documents + current version OCR text from PostgreSQL.
 * 2) Index document metadata + ocrText into Elasticsearch (lexical search).
 * 3) Chunk ocrText, embed each chunk, upsert vectors into Qdrant (semantic).
 */
import { PrismaClient } from "@prisma/client";
import { Client as ESClient } from "@elastic/elasticsearch";
import { QdrantClient } from "@qdrant/js-client-rest";
import { env } from "../src/lib/env";
import { embed, ensureQdrantCollection } from "../src/lib/ai/embeddings";
import { chunkPages } from "../src/lib/ocr/ocrService";

const prisma = new PrismaClient();

async function main() {
  const es = env.elasticUrl ? new ESClient({ node: env.elasticUrl, ...(env.elasticApiKey ? { auth: { apiKey: env.elasticApiKey } } : {}) }) : null;
  const qdrant = env.qdrantUrl ? new QdrantClient({ url: env.qdrantUrl, apiKey: env.qdrantApiKey || undefined }) : null;

  if (es) {
    const exists = await es.indices.exists({ index: env.elasticIndex });
    if (!exists) {
      await es.indices.create({
        index: env.elasticIndex,
        mappings: {
          properties: {
            title: { type: "text", analyzer: "arabic" },
            documentNumber: { type: "keyword" },
            keywords: { type: "text", analyzer: "arabic" },
            departmentName: { type: "keyword" },
            type: { type: "keyword" },
            status: { type: "keyword" },
            departmentId: { type: "keyword" },
            ocrText: { type: "text", analyzer: "arabic" },
            summary: { type: "text", analyzer: "arabic" },
          },
        },
      });
    }
  }
  if (qdrant) await ensureQdrantCollection(env.qdrantCollection);

  const docs = await prisma.document.findMany({
    where: { status: { in: ["PUBLISHED", "ARCHIVED"] } },
    include: { department: true, currentVersion: true },
  });

  let chunkCount = 0;
  for (const d of docs) {
    if (es) {
      await es.index({
        index: env.elasticIndex,
        id: d.id,
        document: {
          title: d.title,
          documentNumber: d.documentNumber,
          keywords: d.keywords,
          departmentName: d.department.name,
          departmentId: d.departmentId,
          type: d.type,
          status: d.status,
          summary: d.summary ?? "",
          ocrText: d.currentVersion?.ocrText ?? "",
        },
      });
    }

    if (qdrant && d.currentVersion?.ocrText) {
      const pages = [{ page: 1, text: d.currentVersion.ocrText }];
      const chunks = chunkPages(pages);
      const points = [];
      for (const c of chunks) {
        const vector = await embed(c.content);
        points.push({
          id: `${d.id}-${c.ordinal}`,
          vector,
          payload: { documentId: d.id, documentNumber: d.documentNumber, title: d.title, page: c.page, content: c.content, departmentId: d.departmentId },
        });
        chunkCount++;
      }
      if (points.length) await qdrant.upsert(env.qdrantCollection, { points });
    }
  }

  if (es) await es.indices.refresh({ index: env.elasticIndex });
  console.log(`✅ Indexed ${docs.length} documents${qdrant ? `, ${chunkCount} vector chunks` : ""}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

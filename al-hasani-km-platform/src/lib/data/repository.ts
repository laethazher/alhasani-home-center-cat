import "server-only";
import { env } from "../env";
import type {
  ComplianceRow,
  DeptCompliance,
  DocumentRecord,
  DocumentStatus,
  DocumentType,
  SessionUser,
  SopRecord,
} from "../types";
import {
  SAMPLE_COMPLIANCE_BY_DEPT,
  SAMPLE_DOCUMENTS,
  SAMPLE_NONCOMPLIANT,
  SAMPLE_SOPS,
  SAMPLE_TREND,
} from "./sampleData";

// ---------------------------------------------------------------------------
//  Visibility — applied uniformly so demo and prod behave identically.
// ---------------------------------------------------------------------------
function visibleToUser(doc: DocumentRecord, user: SessionUser): boolean {
  if (user.role === "ADMIN") return true;
  const orgWide = doc.confidentiality === "PUBLIC" || doc.confidentiality === "INTERNAL";
  if (doc.status === "PUBLISHED" && orgWide) return true;
  return doc.departmentId === user.departmentId && doc.status === "PUBLISHED";
}

export interface DocumentQuery {
  q?: string;
  type?: DocumentType | "ALL";
  status?: DocumentStatus | "ALL";
  departmentId?: string | "ALL";
}

export async function listDocuments(
  user: SessionUser,
  query: DocumentQuery = {}
): Promise<DocumentRecord[]> {
  // PRODUCTION PATH (live data):
  //   const where = buildWhere(user, query);
  //   return prisma.document.findMany({ where, include: { ... }, orderBy: { updatedAt: "desc" } })
  //     .then(mapDocuments);
  // For now (demo), filter the bundled corpus with the same rules.
  let docs = SAMPLE_DOCUMENTS.filter((d) => visibleToUser(d, user));

  if (query.type && query.type !== "ALL") docs = docs.filter((d) => d.type === query.type);
  if (query.status && query.status !== "ALL") docs = docs.filter((d) => d.status === query.status);
  if (query.departmentId && query.departmentId !== "ALL")
    docs = docs.filter((d) => d.departmentId === query.departmentId);
  if (query.q) {
    const q = query.q.trim();
    docs = docs.filter(
      (d) =>
        d.title.includes(q) ||
        d.documentNumber.includes(q) ||
        d.keywords.some((k) => k.includes(q)) ||
        (d.summary?.includes(q) ?? false)
    );
  }
  return docs.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

export async function getDocument(
  user: SessionUser,
  id: string
): Promise<DocumentRecord | null> {
  const doc = SAMPLE_DOCUMENTS.find((d) => d.id === id);
  if (!doc) return null;
  if (!visibleToUser(doc, user)) return null;
  return doc;
}

export async function listSops(user: SessionUser): Promise<SopRecord[]> {
  return SAMPLE_SOPS.filter(
    (s) =>
      user.role === "ADMIN" ||
      s.status === "PUBLISHED" ||
      s.departmentId === user.departmentId
  );
}

export async function getSop(user: SessionUser, id: string): Promise<SopRecord | null> {
  return SAMPLE_SOPS.find((s) => s.id === id || s.code === id) ?? null;
}

// ---------------------------------------------------------------------------
//  Dashboard aggregates
// ---------------------------------------------------------------------------
export interface DashboardData {
  totals: { documents: number; published: number; sops: number; circulars: number };
  myCompliance: { assigned: number; acknowledged: number; pending: number; rate: number };
  byType: { type: DocumentType; label: string; count: number }[];
  byDept: DeptCompliance[];
  trend: typeof SAMPLE_TREND;
  recent: DocumentRecord[];
  expiringSoon: DocumentRecord[];
  pendingForMe: DocumentRecord[];
}

export async function getDashboard(user: SessionUser): Promise<DashboardData> {
  const visible = SAMPLE_DOCUMENTS.filter((d) => visibleToUser(d, user));
  const published = visible.filter((d) => d.status === "PUBLISHED");

  const typeCounts = new Map<DocumentType, number>();
  for (const d of visible) typeCounts.set(d.type, (typeCounts.get(d.type) ?? 0) + 1);

  const pendingForMe = visible.filter(
    (d) => d.status === "PUBLISHED" && d.ack && d.ack !== "ACKNOWLEDGED"
  );
  const assigned = visible.filter((d) => d.status === "PUBLISHED" && d.ack).length;
  const acknowledged = visible.filter((d) => d.ack === "ACKNOWLEDGED").length;

  return {
    totals: {
      documents: visible.length,
      published: published.length,
      sops: visible.filter((d) => d.type === "SOP").length,
      circulars: visible.filter((d) => d.type === "CIRCULAR").length,
    },
    myCompliance: {
      assigned,
      acknowledged,
      pending: assigned - acknowledged,
      rate: assigned ? Math.round((acknowledged / assigned) * 100) : 100,
    },
    byType: Array.from(typeCounts.entries())
      .map(([type, count]) => ({ type, label: type, count }))
      .sort((a, b) => b.count - a.count),
    byDept: SAMPLE_COMPLIANCE_BY_DEPT,
    trend: SAMPLE_TREND,
    recent: [...published].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, 6),
    expiringSoon: published
      .filter((d) => d.expiryDate && new Date(d.expiryDate).getTime() - Date.now() < 35 * 86400000)
      .sort((a, b) => +new Date(a.expiryDate!) - +new Date(b.expiryDate!))
      .slice(0, 5),
    pendingForMe: pendingForMe.slice(0, 5),
  };
}

export async function getComplianceOverview(user: SessionUser): Promise<{
  byDept: DeptCompliance[];
  nonCompliant: ComplianceRow[];
  overallRate: number;
}> {
  const byDept =
    user.role === "ADMIN"
      ? SAMPLE_COMPLIANCE_BY_DEPT
      : SAMPLE_COMPLIANCE_BY_DEPT.filter((d) => d.departmentId === user.departmentId);
  const totalAssigned = byDept.reduce((s, d) => s + d.assigned, 0);
  const totalAck = byDept.reduce((s, d) => s + d.acknowledged, 0);
  const nonCompliant =
    user.role === "ADMIN"
      ? SAMPLE_NONCOMPLIANT
      : SAMPLE_NONCOMPLIANT.filter((r) => r.departmentName === user.departmentName);
  return {
    byDept,
    nonCompliant,
    overallRate: totalAssigned ? Math.round((totalAck / totalAssigned) * 100) : 0,
  };
}

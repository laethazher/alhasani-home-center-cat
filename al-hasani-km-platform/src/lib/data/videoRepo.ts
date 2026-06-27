import "server-only";
import type {
  SessionUser,
  VideoCategoryRecord,
  VideoRecord,
  VideoSearchHit,
} from "../types";
import { SAMPLE_VIDEOS, SAMPLE_VIDEO_CATEGORIES } from "./videoData";

type Viewer = SessionUser | null;

function videoVisible(v: VideoRecord, user: Viewer): boolean {
  if (v.status === "READY") return true;
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return v.departmentId === user.departmentId;
}

export interface VideoQuery {
  q?: string;
  categoryId?: string;
  departmentId?: string;
}

export async function listVideos(user: Viewer, query: VideoQuery = {}): Promise<VideoRecord[]> {
  let rows = SAMPLE_VIDEOS.filter((v) => videoVisible(v, user));
  if (query.categoryId && query.categoryId !== "ALL") rows = rows.filter((v) => v.categoryId === query.categoryId);
  if (query.departmentId && query.departmentId !== "ALL") rows = rows.filter((v) => v.departmentId === query.departmentId);
  if (query.q) {
    const s = query.q.trim();
    rows = rows.filter(
      (v) => v.title.includes(s) || (v.description?.includes(s) ?? false) || v.tags.some((t) => t.includes(s))
    );
  }
  return rows.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export async function getVideo(user: Viewer, idOrSlug: string): Promise<VideoRecord | null> {
  const v = SAMPLE_VIDEOS.find((x) => x.id === idOrSlug || x.slug === idOrSlug);
  if (!v || !videoVisible(v, user)) return null;
  return v;
}

export async function listVideoCategories(): Promise<VideoCategoryRecord[]> {
  return SAMPLE_VIDEO_CATEGORIES;
}

export async function relatedVideos(user: Viewer, video: VideoRecord, k = 4): Promise<VideoRecord[]> {
  const pool = await listVideos(user);
  return pool
    .filter((v) => v.id !== video.id)
    .map((v) => ({
      v,
      score:
        (v.categoryId === video.categoryId ? 2 : 0) +
        (v.departmentId === video.departmentId ? 1 : 0) +
        v.tags.filter((t) => video.tags.includes(t)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.v);
}

/**
 * بحث الفيديو. في وضع العرض يبحث في العنوان/الوصف/الوسوم/الفصول ويعيد الطابع
 * الزمني المطابق. في الإنتاج يندمج مع البحث الدلالي للنسخ النصي (المرحلة الثانية)
 * عبر Qdrant على مجموعة "video_segments" مع إرجاع الطابع الزمني الأدق.
 */
export async function searchVideos(user: Viewer, query: string, limit = 12): Promise<VideoSearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  const hits: VideoSearchHit[] = [];

  for (const v of SAMPLE_VIDEOS) {
    if (!videoVisible(v, user)) continue;
    const matchedIn: VideoSearchHit["matchedIn"] = [];
    let score = 0;
    let timestamp: VideoSearchHit["timestamp"] = null;

    if (v.title.includes(q)) { score += 5; matchedIn.push("title"); }
    if (v.description?.includes(q)) { score += 3; matchedIn.push("description"); }
    if (v.tags.some((t) => t.includes(q) || q.includes(t))) { score += 4; matchedIn.push("tag"); }

    const chapter = v.chapters?.find((c) => c.title.includes(q) || q.includes(c.title.split(" ")[0]));
    if (chapter) { score += 6; matchedIn.push("chapter"); timestamp = { timeSeconds: chapter.timeSeconds, title: chapter.title }; }

    if (score > 0) {
      hits.push({
        id: v.id,
        title: v.title,
        categoryName: v.categoryName,
        departmentName: v.departmentName,
        thumbnailUrl: v.thumbnailUrl,
        durationSeconds: v.durationSeconds,
        snippet: v.description?.slice(0, 140) ?? v.title,
        score,
        matchedIn,
        timestamp,
      });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

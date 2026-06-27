import type { VideoCategoryRecord, VideoRecord } from "../types";

// ───────────────────────────────────────────────────────────────────────────
// مكتبة الفيديو. أُزيلت بيانات التجربة؛ نقطة بداية نظيفة جاهزة لرفع الفيديوهات
// الحقيقية (من واجهة الرفع) أو المزامنة مع نظامك. التصنيفات هيكلة قابلة للتعديل.
// ───────────────────────────────────────────────────────────────────────────

export const SAMPLE_VIDEO_CATEGORIES: VideoCategoryRecord[] = [
  { id: "vcat_ops", name: "العمليات اليومية", slug: "operations", icon: "Workflow", color: "#17B8A1", videosCount: 0 },
  { id: "vcat_inventory", name: "المخزون", slug: "inventory", icon: "Boxes", color: "#3E5C76", videosCount: 0 },
  { id: "vcat_systems", name: "شروحات الأنظمة", slug: "systems", icon: "MonitorPlay", color: "#5E5275", videosCount: 0 },
];

export const SAMPLE_VIDEOS: VideoRecord[] = [];

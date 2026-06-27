/** رابط نظام المركبات — /system في التطوير والإنتاج الموحّد. */
export function getFleetSystemUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SYSTEM_URL?.trim();
  if (configured) return configured;
  if (
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_UNIFIED === "1"
  ) {
    return "/system";
  }
  return "https://alhasani-home-center-cat.onrender.com";
}

export function isFleetSystemExternal(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

/** هل نستخدم الإنتاج الموحّد (Render / UNIFIED_PROD)؟ */
export function isUnifiedProduction() {
  return (
    process.env.UNIFIED_PROD === "1" ||
    process.env.RENDER === "true" ||
    process.env.START_UNIFIED === "1"
  );
}

// Centralized env access with sensible dev defaults.
export const env = {
  jwtSecret: process.env.JWT_SECRET || "dev-insecure-secret-change-me-please-32+chars",
  jwtIssuer: process.env.JWT_ISSUER || "al-hasani-km",
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 8),

  databaseUrl: process.env.DATABASE_URL || "",
  directUrl: process.env.DIRECT_URL || "",

  // Authentication provider: "local" (demo/JWT) | "supabase" (unified SSO).
  authProvider: (process.env.AUTH_PROVIDER || "local").toLowerCase(),

  // Supabase (unified identity + database + storage with the Home Center system).
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  videoBucket: process.env.SUPABASE_VIDEO_BUCKET || "academy-videos",

  geminiKey: process.env.GEMINI_API_KEY || "",

  elasticUrl: process.env.ELASTICSEARCH_URL || "",
  elasticIndex: process.env.ELASTICSEARCH_INDEX || "documents",
  elasticApiKey: process.env.ELASTICSEARCH_API_KEY || "",

  qdrantUrl: process.env.QDRANT_URL || "",
  qdrantCollection: process.env.QDRANT_COLLECTION || "document_chunks",
  qdrantApiKey: process.env.QDRANT_API_KEY || "",

  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  aiModel: process.env.AI_MODEL || "claude-sonnet-4-6",
  embeddingDim: Number(process.env.EMBEDDING_DIM || 1024),

  ocrProvider: process.env.OCR_PROVIDER || "tesseract",

  // Public
  demoMode:
    (process.env.NEXT_PUBLIC_DEMO_MODE ?? "true").toLowerCase() !== "false",
};

export const SESSION_COOKIE = "khm_session";

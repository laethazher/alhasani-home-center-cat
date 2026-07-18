import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const baseRaw = process.env.VITE_BASE_PATH || "/";
const basePath = baseRaw.endsWith("/") ? baseRaw.slice(0, -1) : baseRaw;
const unified = basePath === "/system";
const dist = path.resolve(__dirname, "dist");
const startedAt = Date.now();

app.use(express.json({ limit: "50mb" }));

function safeParse(v) {
  if (v == null) return v;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}

let db;
if (unified) {
  const dbPath = path.resolve(__dirname, "reports.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      driverName TEXT NOT NULL,
      truckNumber TEXT NOT NULL,
      date TEXT NOT NULL,
      damagePoints TEXT,
      inspectionValues TEXT,
      toolValues TEXT,
      toolImages TEXT,
      driverSignature TEXT,
      equipmentManagerSignature TEXT,
      logisticsManagerSignature TEXT,
      warehouseManagerSignature TEXT,
      createdat DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("✅ SQLite (unified fleet) at", dbPath);
}

app.get(["/ping", "/PING"], (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    ok: true,
    service: unified ? "alhasani-fleet-unified" : "alhasani-home-center",
    uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  });
});

if (unified && db) {
  app.post("/api/reports", (req, res) => {
    try {
      const b = req.body;
      const stmt = db.prepare(`
        INSERT INTO reports (driverName, truckNumber, date, damagePoints, inspectionValues, toolValues, toolImages, driverSignature, equipmentManagerSignature, logisticsManagerSignature, warehouseManagerSignature)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        b.driverName,
        b.truckNumber,
        b.date,
        JSON.stringify(b.damagePoints),
        JSON.stringify(b.inspectionValues),
        JSON.stringify(b.toolValues),
        JSON.stringify(b.toolImages),
        b.driverSignature,
        b.equipmentManagerSignature,
        b.logisticsManagerSignature,
        b.warehouseManagerSignature
      );
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, error: "Failed to save report" });
    }
  });

  app.get("/api/reports", (_req, res) => {
    try {
      const rows = db.prepare("SELECT * FROM reports ORDER BY createdat DESC").all();
      res.json(
        rows.map((r) => ({
          ...r,
          damagePoints: safeParse(r.damagePoints),
          inspectionValues: safeParse(r.inspectionValues),
          toolValues: safeParse(r.toolValues),
          toolImages: safeParse(r.toolImages),
        }))
      );
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, error: "Failed to fetch reports" });
    }
  });
}

if (unified) {
  app.use(basePath, express.static(dist, { maxAge: "1y", immutable: true }));
  app.get(`${basePath}`, (_req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
  app.get(`${basePath}/*`, (_req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
} else {
  app.use(express.static(dist, { maxAge: "1y", immutable: true }));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  const suffix = unified ? `${basePath}/` : "/";
  console.log(`✅ Fleet server on http://0.0.0.0:${PORT}${suffix}`);
});

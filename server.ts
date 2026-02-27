import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USE_PG = !!process.env.DATABASE_URL;
console.log("Database mode:", USE_PG ? "✅ PostgreSQL" : "⚠️  SQLite (local only)");

// ─── Database abstraction layer ───
let pgPool: pg.Pool | null = null;
let sqliteDb: InstanceType<typeof Database> | null = null;

if (USE_PG) {
  pgPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  // Create table if it doesn't exist
  pgPool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      drivername TEXT NOT NULL,
      trucknumber TEXT NOT NULL,
      date TEXT NOT NULL,
      damagepoints TEXT,
      inspectionvalues TEXT,
      toolvalues TEXT,
      toolimages TEXT,
      driversignature TEXT,
      equipmentmanagersignature TEXT,
      logisticsmanagersignature TEXT,
      warehousemanagersignature TEXT,
      createdat TIMESTAMP DEFAULT NOW()
    );
  `).then(() => console.log("✅ PostgreSQL table ready"))
    .catch((e) => console.error("❌ PostgreSQL init error:", e.message));
} else {
  const dbPath = path.resolve(__dirname, "reports.db");
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma("journal_mode = WAL");
  sqliteDb.exec(`
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
  console.log("✅ SQLite database initialized at", dbPath);
}

function safeParse(v: any) {
  if (v === null || v === undefined) return v;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Route to save report
  app.post("/api/reports", async (req, res) => {
    try {
      const { 
        driverName, 
        truckNumber, 
        date, 
        damagePoints, 
        inspectionValues, 
        toolValues,
        toolImages,
        driverSignature,
        equipmentManagerSignature,
        logisticsManagerSignature,
        warehouseManagerSignature
      } = req.body;

      if (USE_PG && pgPool) {
        const result = await pgPool.query(
          `INSERT INTO reports (drivername, trucknumber, date, damagepoints, inspectionvalues, toolvalues, toolimages, driversignature, equipmentmanagersignature, logisticsmanagersignature, warehousemanagersignature) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
          [
            driverName, truckNumber, date,
            JSON.stringify(damagePoints),
            JSON.stringify(inspectionValues),
            JSON.stringify(toolValues),
            JSON.stringify(toolImages),
            driverSignature, equipmentManagerSignature,
            logisticsManagerSignature, warehouseManagerSignature
          ]
        );
        res.json({ success: true, id: result.rows[0].id });
      } else if (sqliteDb) {
        const stmt = sqliteDb.prepare(
          `INSERT INTO reports (driverName, truckNumber, date, damagePoints, inspectionValues, toolValues, toolImages, driverSignature, equipmentManagerSignature, logisticsManagerSignature, warehouseManagerSignature) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        const result = stmt.run(
          driverName, truckNumber, date,
          JSON.stringify(damagePoints),
          JSON.stringify(inspectionValues),
          JSON.stringify(toolValues),
          JSON.stringify(toolImages),
          driverSignature, equipmentManagerSignature,
          logisticsManagerSignature, warehouseManagerSignature
        );
        res.json({ success: true, id: result.lastInsertRowid });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: "Failed to save report" });
    }
  });

  // API Route to get all reports
  app.get("/api/reports", async (req, res) => {
    try {
      let reports: any[];

      if (USE_PG && pgPool) {
        const result = await pgPool.query("SELECT * FROM reports ORDER BY createdat DESC");
        reports = result.rows.map((r: any) => ({
          id: r.id,
          driverName: r.drivername,
          truckNumber: r.trucknumber,
          date: r.date,
          damagePoints: safeParse(r.damagepoints),
          inspectionValues: safeParse(r.inspectionvalues),
          toolValues: safeParse(r.toolvalues),
          toolImages: safeParse(r.toolimages),
          driverSignature: r.driversignature,
          equipmentManagerSignature: r.equipmentmanagersignature,
          logisticsManagerSignature: r.logisticsmanagersignature,
          warehouseManagerSignature: r.warehousemanagersignature,
          createdAt: r.createdat,
        }));
      } else if (sqliteDb) {
        const stmt = sqliteDb.prepare("SELECT * FROM reports ORDER BY createdat DESC");
        const rows = stmt.all() as any[];
        reports = rows.map((r: any) => ({
          ...r,
          damagePoints: safeParse(r.damagePoints),
          inspectionValues: safeParse(r.inspectionValues),
          toolValues: safeParse(r.toolValues),
          toolImages: safeParse(r.toolImages),
        }));
      } else {
        reports = [];
      }

      res.json(reports);
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: "Failed to fetch reports" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

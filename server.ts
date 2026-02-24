import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

console.log("DATABASE_URL =", process.env.DATABASE_URL ? "✅ provided" : "⚠️  not set (using SQLite)");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite database
const dbPath = path.resolve(__dirname, "reports.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    driverName TEXT NOT NULL,
    truckNumber TEXT NOT NULL,
    date TEXT NOT NULL,
    damagePoints TEXT,
    inspectionValues TEXT,
    toolValues TEXT,
    driverSignature TEXT,
    equipmentManagerSignature TEXT,
    logisticsManagerSignature TEXT,
    warehouseManagerSignature TEXT,
    createdat DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

console.log("✅ SQLite database initialized at", dbPath);

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
        driverSignature,
        equipmentManagerSignature,
        logisticsManagerSignature,
        warehouseManagerSignature
      } = req.body;

      // Insert into SQLite
      const stmt = db.prepare(`
        INSERT INTO reports (driverName, truckNumber, date, damagePoints, inspectionValues, toolValues, driverSignature, equipmentManagerSignature, logisticsManagerSignature, warehouseManagerSignature) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        driverName, 
        truckNumber, 
        date, 
        JSON.stringify(damagePoints), 
        JSON.stringify(inspectionValues), 
        JSON.stringify(toolValues), 
        driverSignature, 
        equipmentManagerSignature, 
        logisticsManagerSignature, 
        warehouseManagerSignature
      );

      res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: "Failed to save report" });
    }
  });

  // API Route to get all reports
  app.get("/api/reports", async (req, res) => {
    try {
      const stmt = db.prepare("SELECT * FROM reports ORDER BY createdat DESC");
      const rows = stmt.all() as any[];

      const reports = rows.map((r: any) => ({
        ...r,
        damagePoints: safeParse(r.damagePoints),
        inspectionValues: safeParse(r.inspectionValues),
        toolValues: safeParse(r.toolValues)
      }));

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

import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import transactionRoutes from "./routes/transactions";
import settingsRoutes from "./routes/settings";
import backupRoutes from "./routes/backup";
import reportRoutes from "./routes/reports";

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──
app.use(cors());
app.use(express.json());

// ── إنشاء المجلدات المطلوبة ──
const dataDir = path.join(__dirname, "..", "data");
const backupsDir = path.join(__dirname, "..", "backups");
for (const dir of [dataDir, backupsDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── Routes ──
app.use("/api/transactions", transactionRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/backup", backupRoutes);
app.use("/api/reports", reportRoutes);

// ── Health Check ──
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", message: "نظام إدارة الرصيد يعمل بنجاح" });
});

// ── Serve Frontend in Production ──
const frontendBuild = path.join(__dirname, "..", "..", "frontend", "dist");
if (fs.existsSync(frontendBuild)) {
  app.use(express.static(frontendBuild));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(frontendBuild, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`\n  ✓ الخادم يعمل على: http://localhost:${PORT}`);
  console.log(`  ✓ قاعدة البيانات: ${path.join(dataDir, "account.db")}\n`);
});

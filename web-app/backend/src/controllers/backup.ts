import { Request, Response } from "express";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const DB_PATH = path.join(DATA_DIR, "account.db");
const BACKUPS_DIR = path.join(__dirname, "..", "..", "backups");

// ── إنشاء نسخة احتياطية ──
export const createBackup = async (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFileName = `backup_${timestamp}.db`;
    const backupPath = path.join(BACKUPS_DIR, backupFileName);

    fs.copyFileSync(DB_PATH, backupPath);

    res.json({
      message: "تم إنشاء النسخة الاحتياطية بنجاح",
      file: backupFileName,
      path: backupPath,
    });
  } catch (error) {
    res.status(500).json({ error: "خطأ في إنشاء النسخة الاحتياطية" });
  }
};

// ── جلب قائمة النسخ الاحتياطية ──
export const listBackups = async (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      return res.json([]);
    }

    const files = fs
      .readdirSync(BACKUPS_DIR)
      .filter((f) => f.endsWith(".db"))
      .map((f) => {
        const stats = fs.statSync(path.join(BACKUPS_DIR, f));
        return {
          name: f,
          size: stats.size,
          date: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json(files);
  } catch (error) {
    res.status(500).json({ error: "خطأ في جلب النسخ الاحتياطية" });
  }
};

// ── استعادة نسخة احتياطية ──
export const restoreBackup = async (req: Request, res: Response) => {
  try {
    const { filename } = req.body;
    const backupPath = path.join(BACKUPS_DIR, filename);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: "النسخة الاحتياطية غير موجودة" });
    }

    fs.copyFileSync(backupPath, DB_PATH);

    res.json({ message: "تمت استعادة النسخة الاحتياطية بنجاح" });
  } catch (error) {
    res.status(500).json({ error: "خطأ في استعادة النسخة الاحتياطية" });
  }
};

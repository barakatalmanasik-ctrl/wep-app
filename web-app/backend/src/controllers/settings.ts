import { Request, Response } from "express";
import prisma from "../lib/prisma";

// ── جلب الإعدادات ──
export const getSettings = async (_req: Request, res: Response) => {
  try {
    let settings = await prisma.setting.findUnique({ where: { id: 1 } });

    if (!settings) {
      settings = await prisma.setting.create({
        data: { id: 1 },
      });
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "خطأ في جلب الإعدادات" });
  }
};

// ── تحديث الإعدادات ──
export const updateSettings = async (req: Request, res: Response) => {
  try {
    const { companyName, currency, themeColor } = req.body;

    const settings = await prisma.setting.upsert({
      where: { id: 1 },
      update: { companyName, currency, themeColor },
      create: { id: 1, companyName, currency, themeColor },
    });

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "خطأ في تحديث الإعدادات" });
  }
};

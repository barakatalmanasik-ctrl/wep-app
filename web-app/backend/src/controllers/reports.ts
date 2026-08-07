import { Request, Response } from "express";
import prisma from "../lib/prisma";

// ── جلب تقرير ملخص ──
export const getReport = async (_req: Request, res: Response) => {
  try {
    const [increaseSum, decreaseSum, totalCount, transactions] =
      await Promise.all([
        prisma.transaction.aggregate({
          where: { type: "تعزيز" },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { type: "قطع" },
          _sum: { amount: true },
        }),
        prisma.transaction.count(),
        prisma.transaction.findMany({
          orderBy: [{ date: "desc" }, { id: "desc" }],
        }),
      ]);

    const currentBalance =
      transactions.length > 0 ? transactions[0].balanceAfter : 0;

    res.json({
      currentBalance,
      totalIncrease: increaseSum._sum.amount || 0,
      totalDecrease: decreaseSum._sum.amount || 0,
      totalCount,
      transactions,
    });
  } catch (error) {
    res.status(500).json({ error: "خطأ في جلب التقرير" });
  }
};

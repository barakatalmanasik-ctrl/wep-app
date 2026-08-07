import { Request, Response } from "express";
import prisma from "../lib/prisma";

// ── جلب جميع الحركات ──
export const getAllTransactions = async (_req: Request, res: Response) => {
  try {
    const transactions = await prisma.transaction.findMany({
      orderBy: [{ date: "desc" }, { id: "desc" }],
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: "خطأ في جلب الحركات" });
  }
};

// ── جلب حركات مفلترة ──
export const getFilteredTransactions = async (req: Request, res: Response) => {
  try {
    const { type, search, date } = req.query;
    const where: any = {};

    if (type && type !== "الكل") {
      where.type = type;
    }

    if (search && typeof search === "string") {
      where.notes = { contains: search };
    }

    if (date && typeof date === "string" && date.trim() !== "") {
      where.date = date;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: [{ date: "desc" }, { id: "desc" }],
    });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: "خطأ في جلب الحركات" });
  }
};

// ── جلب الرصيد الحالي ──
const getCurrentBalance = async (): Promise<number> => {
  const last = await prisma.transaction.findFirst({
    orderBy: [{ date: "desc" }, { id: "desc" }],
    select: { balanceAfter: true },
  });
  return last ? last.balanceAfter : 0;
};

// ── جلب الملخص ──
export const getSummary = async (_req: Request, res: Response) => {
  try {
    const [increaseSum, decreaseSum, totalCount, currentBalance] =
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
        getCurrentBalance(),
      ]);

    res.json({
      currentBalance,
      totalIncrease: increaseSum._sum.amount || 0,
      totalDecrease: decreaseSum._sum.amount || 0,
      totalCount,
    });
  } catch (error) {
    res.status(500).json({ error: "خطأ في جلب الملخص" });
  }
};

// ── إعادة حساب جميع الأرصدة ──
const recalculateBalances = async () => {
  const all = await prisma.transaction.findMany({
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });

  let balance = 0;
  for (const t of all) {
    balance = t.type === "تعزيز" ? balance + t.amount : balance - t.amount;
    await prisma.transaction.update({
      where: { id: t.id },
      data: { balanceAfter: balance },
    });
  }
  return balance;
};

// ── إضافة حركة ──
export const createTransaction = async (req: Request, res: Response) => {
  try {
    const { date, type, amount, notes } = req.body;

    if (!date || !type || !amount || amount <= 0) {
      return res.status(400).json({ error: "يرجى إدخال جميع الحقول بشكل صحيح" });
    }

    if (type !== "تعزيز" && type !== "قطع") {
      return res.status(400).json({ error: "نوع الحركة غير صحيح" });
    }

    const currentBalance = await getCurrentBalance();

    if (type === "قطع" && amount > currentBalance) {
      return res.status(400).json({ error: "الرصيد غير كافٍ" });
    }

    const balanceAfter =
      type === "تعزيز" ? currentBalance + amount : currentBalance - amount;

    const transaction = await prisma.transaction.create({
      data: { date, type, amount, balanceAfter, notes: notes || "" },
    });

    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ error: "خطأ في إنشاء الحركة" });
  }
};

// ── تعديل حركة ──
export const updateTransaction = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { date, type, amount, notes } = req.body;

    if (!date || !type || !amount || amount <= 0) {
      return res.status(400).json({ error: "يرجى إدخال جميع الحقول بشكل صحيح" });
    }

    await prisma.transaction.update({
      where: { id: parseInt(id) },
      data: { date, type, amount, notes: notes || "" },
    });

    await recalculateBalances();

    const updated = await prisma.transaction.findUnique({
      where: { id: parseInt(id) },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "خطأ في تعديل الحركة" });
  }
};

// ── حذف حركة ──
export const deleteTransaction = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.transaction.delete({
      where: { id: parseInt(id) },
    });

    await recalculateBalances();

    res.json({ message: "تم حذف الحركة بنجاح" });
  } catch (error) {
    res.status(500).json({ error: "خطأ في حذف الحركة" });
  }
};

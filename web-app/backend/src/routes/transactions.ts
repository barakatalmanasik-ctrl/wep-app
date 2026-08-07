import { Router } from "express";
import {
  getAllTransactions,
  getFilteredTransactions,
  getSummary,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from "../controllers/transactions";

const router = Router();

router.get("/", getAllTransactions);
router.get("/filtered", getFilteredTransactions);
router.get("/summary", getSummary);
router.post("/", createTransaction);
router.put("/:id", updateTransaction);
router.delete("/:id", deleteTransaction);

export default router;

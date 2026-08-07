import { Router } from "express";
import { createBackup, listBackups, restoreBackup } from "../controllers/backup";

const router = Router();

router.post("/create", createBackup);
router.get("/list", listBackups);
router.post("/restore", restoreBackup);

export default router;

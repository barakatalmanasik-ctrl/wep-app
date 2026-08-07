import { Router } from "express";
import { getReport } from "../controllers/reports";

const router = Router();

router.get("/", getReport);

export default router;

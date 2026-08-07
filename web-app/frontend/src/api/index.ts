import axios from "axios";
import type {
  Transaction,
  Summary,
  Settings,
  BackupFile,
  ReportData,
} from "../types";

const api = axios.create({ baseURL: "/api" });

// ── الحركات ──
export const transactionsApi = {
  getAll: () => api.get<Transaction[]>("/transactions").then((r) => r.data),

  getFiltered: (params: {
    type?: string;
    search?: string;
    date?: string;
  }) => api.get<Transaction[]>("/transactions/filtered", { params }).then((r) => r.data),

  getSummary: () => api.get<Summary>("/transactions/summary").then((r) => r.data),

  create: (data: {
    date: string;
    type: string;
    amount: number;
    notes: string;
  }) => api.post<Transaction>("/transactions", data).then((r) => r.data),

  update: (
    id: number,
    data: { date: string; type: string; amount: number; notes: string }
  ) => api.put<Transaction>(`/transactions/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    api.delete(`/transactions/${id}`).then((r) => r.data),
};

// ── الإعدادات ──
export const settingsApi = {
  get: () => api.get<Settings>("/settings").then((r) => r.data),

  update: (data: {
    companyName: string;
    currency: string;
    themeColor: string;
  }) => api.put<Settings>("/settings", data).then((r) => r.data),
};

// ── النسخ الاحتياطي ──
export const backupApi = {
  list: () => api.get<BackupFile[]>("/backup/list").then((r) => r.data),

  create: () => api.post("/backup/create").then((r) => r.data),

  restore: (filename: string) =>
    api.post("/backup/restore", { filename }).then((r) => r.data),
};

// ── التقارير ──
export const reportsApi = {
  get: () => api.get<ReportData>("/reports").then((r) => r.data),
};

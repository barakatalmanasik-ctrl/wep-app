export interface Transaction {
  id: number;
  date: string;
  type: "تعزيز" | "قطع";
  amount: number;
  balanceAfter: number;
  notes: string;
  createdAt: string;
}

export interface Summary {
  currentBalance: number;
  totalIncrease: number;
  totalDecrease: number;
  totalCount: number;
}

export interface Settings {
  id: number;
  companyName: string;
  currency: string;
  themeColor: string;
}

export interface BackupFile {
  name: string;
  size: number;
  date: string;
}

export interface ReportData extends Summary {
  transactions: Transaction[];
}

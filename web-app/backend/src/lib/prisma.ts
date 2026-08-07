import { PrismaClient } from "@prisma/client";
import path from "path";
import fs from "fs";

const dataDir = path.join(__dirname, "..", "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${path.join(dataDir, "account.db")}`,
    },
  },
});

export default prisma;

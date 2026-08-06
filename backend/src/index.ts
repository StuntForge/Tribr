import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import authRoutes from "./routes/auth";
import profileRoutes from "./routes/profile";
import uploadRoutes from "./routes/uploads";
import taskRoutes from "./routes/tasks";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api", profileRoutes);
app.use("/api", taskRoutes);
app.use("/api/uploads", uploadRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? "Something went wrong." });
});

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`Project Exchange API listening on http://localhost:${port}`);
});

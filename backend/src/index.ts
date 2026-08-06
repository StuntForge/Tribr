import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import authRoutes from "./routes/auth";
import profileRoutes from "./routes/profile";
import uploadRoutes from "./routes/uploads";
import taskRoutes from "./routes/tasks";
import groupRoutes from "./routes/groups";
import devRoutes from "./routes/dev";
import scheduleRoutes from "./routes/schedule";
import chatRoutes from "./routes/chat";
import notificationRoutes from "./routes/notifications";
import searchRoutes from "./routes/search";
import subscriptionRoutes from "./routes/subscription";
import stripeWebhookRoutes from "./routes/stripeWebhook";

const app = express();

app.use(cors());
// Stripe webhook needs the raw, unparsed body to verify its signature, so it
// must be mounted before the global JSON body parser.
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhookRoutes);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api", profileRoutes);
app.use("/api", taskRoutes);
app.use("/api", groupRoutes);
app.use("/api", scheduleRoutes);
app.use("/api", chatRoutes);
app.use("/api", searchRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/dev", devRoutes);
app.use("/api/notifications", notificationRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? "Something went wrong." });
});

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`Project Exchange API listening on http://localhost:${port}`);
});

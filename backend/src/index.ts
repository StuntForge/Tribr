import "dotenv/config";
import express from "express";
import cors from "cors";
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
import adminRoutes from "./routes/admin";
import internalRoutes from "./routes/internal";

const app = express();

app.use(cors());
// Stripe webhook needs the raw, unparsed body to verify its signature, so it
// must be mounted before the global JSON body parser.
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhookRoutes);
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

// More specific paths must be mounted before the generic "/api" routers
// below - Express matches app.use() by path prefix in registration order,
// not by best match, so a generic "/api" router mounted first would
// otherwise intercept e.g. "/api/admin/login" and run its own (wrong, or in
// admin's case entirely inapplicable) auth check before this ever gets hit.
app.use("/api/auth", authRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/dev", devRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/internal", internalRoutes);

app.use("/api", profileRoutes);
app.use("/api", taskRoutes);
app.use("/api", groupRoutes);
app.use("/api", scheduleRoutes);
app.use("/api", chatRoutes);
app.use("/api", searchRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? "Something went wrong." });
});

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`Tribr API listening on http://localhost:${port}`);
});

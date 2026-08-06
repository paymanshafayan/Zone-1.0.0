require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const logger = require("./utils/logger");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Security Middleware =====
app.use(helmet());

app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? ["https://yourfrontend.com"]
    : ["http://localhost:3000", "http://localhost:5173"],
  credentials: true,
}));

// ===== Rate Limiting =====
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: "RATE_LIMIT_EXCEEDED",
    message: "تعداد درخواست‌های شما از حد مجاز گذشته است",
  },
});
app.use(limiter);

// ===== Body Parsing =====
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ===== Health Check =====
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Zone API is running!",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// ===== 404 Handler =====
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "NOT_FOUND",
    message: `Route ${req.originalUrl} not found`,
  });
});

// ===== Global Error Handler =====
app.use((error, req, res, next) => {
  logger.error("Unhandled Error:", {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
  });

  res.status(error.status || 500).json({
    success: false,
    error: "INTERNAL_SERVER_ERROR",
    message: process.env.NODE_ENV === "production"
      ? "خطای داخلی سرور رخ داده است"
      : error.message,
  });
});

// ===== Start Server =====
const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      logger.info(`🚀 Zone Server running on port ${PORT}`);
      logger.info(`🔗 Health: http://localhost:${PORT}/api/health`);
      logger.info(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    logger.error("❌ Server failed to start:", error);
    process.exit(1);
  }
};

// ===== Graceful Shutdown =====
process.on("SIGTERM", () => {
  logger.info("⚠️ SIGTERM received. Shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("⚠️ SIGINT received. Shutting down...");
  process.exit(0);
});

process.on("unhandledRejection", (reason) => {
  logger.error("❌ Unhandled Rejection:", { reason });
});

process.on("uncaughtException", (error) => {
  logger.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

startServer();

module.exports = app;
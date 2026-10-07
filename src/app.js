// ===========================================================================
// APLIKASI EXPRESS — pasang middleware, file statis, dan semua route.
// ===========================================================================
const express = require("express");
const cors = require("cors");
const path = require("path");

const { CORS_ORIGINS } = require("./config/env");
const { absoluteUrls } = require("./middleware/absoluteUrls");
const { notFound, errorHandler } = require("./middleware/error");
const apiRoutes = require("./routes");

const app = express();

app.use(cors(CORS_ORIGINS.length ? { origin: CORS_ORIGINS } : undefined));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// File statis: foto upload & aset bawaan
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use("/app/assets", express.static(path.join(__dirname, "..", "public", "assets")));

// Semua endpoint ada di /api
app.use("/api", absoluteUrls, apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;

/**
 * Ox Video Gallery Server
 * Entry point - Modular Version
 */
const express = require("express");
const { setupMiddleware } = require("./src/config");
const { setupRoutes } = require("./src/routes");

const app = express();
const PORT = 3000;

// Setup middleware (CORS, static files, etc.)
setupMiddleware(app, __dirname);

// Setup routes (API and pages)
setupRoutes(app, __dirname);

// Start server
app.listen(PORT, () => {
  console.log(`Ox berjalan di http://localhost:${PORT}`);
});

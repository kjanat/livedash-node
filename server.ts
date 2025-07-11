// Custom Next.js server with configurable scheduler initialization
import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { startBatchScheduler } from "./lib/batchProcessorIntegration.js";
import { getSchedulerConfig, logEnvConfig, validateEnv } from "./lib/env.js";
import { startImportProcessingScheduler } from "./lib/importProcessor.js";
import { startProcessingScheduler } from "./lib/processingScheduler.js";
import { startCsvImportScheduler } from "./lib/scheduler.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = Number.parseInt(process.env.PORT || "3000", 10);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Validate and log environment configuration
  const envValidation = validateEnv();
  if (!envValidation.valid) {
    console.error("[Environment] Validation errors:", envValidation.errors);
  }

  logEnvConfig();

  // Get scheduler configuration
  const config = getSchedulerConfig();

  // Initialize schedulers based on configuration
  if (config.enabled) {
    console.log("Initializing schedulers...");
    startCsvImportScheduler();
    startImportProcessingScheduler();
    startProcessingScheduler();
    startBatchScheduler();
    console.log("All schedulers initialized successfully");
  }

  createServer(async (req, res) => {
    try {
      // Parse the URL
      const parsedUrl = parse(req.url || "", true);

      // Let Next.js handle the request
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  }).listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});

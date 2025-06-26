// Custom Next.js server with scheduler initialization
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { processUnprocessedSessions } from "./lib/processingSchedulerNoCron.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Start processing scheduler in the background
  const BATCH_SIZE = 10;
  const MAX_CONCURRENCY = 5;
  const SCHEDULER_INTERVAL = 5 * 60 * 1000; // 5 minutes

  // Initial processing run
  processUnprocessedSessions(BATCH_SIZE, MAX_CONCURRENCY).catch(console.error);

  // Schedule regular processing
  setInterval(() => {
    processUnprocessedSessions(BATCH_SIZE, MAX_CONCURRENCY).catch(console.error);
  }, SCHEDULER_INTERVAL);

  console.log("Processing scheduler started with 5 minute interval");

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

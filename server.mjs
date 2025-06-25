// Custom Next.js server with scheduler initialization
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

// We'll need to dynamically import these after they're compiled
let startScheduler;
let startProcessingScheduler;

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function init() {
  try {
    // Dynamically import the schedulers
    const scheduler = await import('./lib/scheduler.js');
    const processingScheduler = await import('./lib/processingScheduler.js');

    startScheduler = scheduler.startScheduler;
    startProcessingScheduler = processingScheduler.startProcessingScheduler;

    app.prepare().then(() => {
      // Initialize schedulers when the server starts
      console.log('Starting schedulers...');
      startScheduler();
      startProcessingScheduler();
      console.log('All schedulers initialized successfully');

      createServer(async (req, res) => {
        try {
          // Parse the URL
          const parsedUrl = parse(req.url || '', true);

          // Let Next.js handle the request
          await handle(req, res, parsedUrl);
        } catch (err) {
          console.error('Error occurred handling', req.url, err);
          res.statusCode = 500;
          res.end('Internal Server Error');
        }
      }).listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
      });
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

init();

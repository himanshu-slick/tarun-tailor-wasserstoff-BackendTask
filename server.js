const express = require("express");
const app = express();
const morgan = require("morgan");
const bodyParser = require("body-parser");
const Queue = require("bull");
const fs = require("fs");
const path = require("path");

// Middleware
app.use(morgan("dev"));
app.use(bodyParser.json());

// Mock REST API endpoints with varied response times
const mockRESTAPIs = [
  {
    endpoint: "/api/v1/resource",
    handleRequest: (req, res) => {
      const delay = Math.floor(Math.random() * 2000) + 500; // Simulate response time between 500ms and 2.5s
      setTimeout(() => {
        res.status(200).json({ message: "REST API v1 response" });
      }, delay);
    },
  },
  {
    endpoint: "/api/v2/resource",
    handleRequest: (req, res) => {
      const delay = Math.floor(Math.random() * 1000) + 200; // Simulate response time between 200ms and 1.2s
      setTimeout(() => {
        res.status(200).json({ message: "REST API v2 response" });
      }, delay);
    },
  },
];

// Queues
const mainQueue = new Queue("mainQueue", "queues/mainQueue.json");
const usaQueue = new Queue("usaQueue", "queues/usaQueue.json");
const europeQueue = new Queue("europeQueue", "queues/europeQueue.json");
const indiaQueue = new Queue("indiaQueue", "queues/indiaQueue.json");

// Logging and metrics
const queueLogs = [];

// Request validation
const validateRequest = (req, res, next) => {
  const { method, url, headers } = req;
  const location = headers.location;

  if (!method || !url || !location) {
    return res.status(400).json({ error: "Invalid request" });
  }

  next();
};

// Queue management
const manageQueues = (req, res) => {
  const { method, url, headers } = req;
  const location = headers.location;
  const requestId = Date.now(); // Unique request ID

  // Log request details
  console.log(`Incoming ${method} request (${requestId}): ${url}`);
  console.log(`Location: ${location}`);

  // Add request to the main queue
  mainQueue.add(
    { method, url, location, requestId },
    { removeOnComplete: true }
  );
  queueLogs.push({
    queue: "mainQueue",
    request: { method, url, location, requestId },
  });

  res.status(202).json({ message: "Request queued for processing" });
};

// Main queue processing
mainQueue.process(async (job, done) => {
  const { method, url, location, requestId } = job.data;

  try {
    // Distribute requests to regional queues based on location
    if (location === "USA") {
      await usaQueue.add({ method, url, requestId });
      queueLogs.push({
        queue: "usaQueue",
        request: { method, url, location, requestId },
      });
    } else if (location === "Europe") {
      await europeQueue.add({ method, url, requestId });
      queueLogs.push({
        queue: "europeQueue",
        request: { method, url, location, requestId },
      });
    } else if (location === "India") {
      await indiaQueue.add({ method, url, requestId });
      queueLogs.push({
        queue: "indiaQueue",
        request: { method, url, location, requestId },
      });
    } else {
      console.error(`Invalid location: ${location}`);
    }
  } catch (error) {
    console.error(`Error processing job ${requestId}:`, error);
  } finally {
    done();
  }
});

// Regional queue processing
usaQueue.process(async (job, done) => {
  const { method, url, requestId } = job.data;
  try {
    const randomAPI =
      mockRESTAPIs[Math.floor(Math.random() * mockRESTAPIs.length)];
    randomAPI.handleRequest({ method, url }, { json: () => {} });
  } catch (error) {
    console.error(`Error processing job ${requestId}:`, error);
  } finally {
    done();
  }
});

europeQueue.process(async (job, done) => {
  const { method, url, requestId } = job.data;
  try {
    const randomAPI =
      mockRESTAPIs[Math.floor(Math.random() * mockRESTAPIs.length)];
    randomAPI.handleRequest({ method, url }, { json: () => {} });
  } catch (error) {
    console.error(`Error processing job ${requestId}:`, error);
  } finally {
    done();
  }
});

indiaQueue.process(async (job, done) => {
  const { method, url, requestId } = job.data;
  try {
    const randomAPI =
      mockRESTAPIs[Math.floor(Math.random() * mockRESTAPIs.length)];
    randomAPI.handleRequest({ method, url }, { json: () => {} });
  } catch (error) {
    console.error(`Error processing job ${requestId}:`, error);
  } finally {
    done();
  }
});

// Apply queue management for all requests
app.use(validateRequest, manageQueues);

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Analyze queue performance
setInterval(() => {
  console.log("Queue performance analysis:");
  const mainQueueSize = mainQueue.size;
  const usaQueueSize = usaQueue.size;
  const europeQueueSize = europeQueue.size;
  const indiaQueueSize = indiaQueue.size;

  console.log(`Main queue size: ${mainQueueSize}`);
  console.log(`USA queue size: ${usaQueueSize}`);
  europeQueueSize && console.log(`Europe queue size: ${europeQueueSize}`);
  console.log(`India queue size: ${indiaQueueSize}`);

  console.log("Queue logs:");
  queueLogs.forEach((log) => {
    console.log(
      `${log.queue} queue: ${log.request.method} ${log.request.url} (${log.request.location}) [${log.request.requestId}]`
    );
  });
}, 10000); // Analyze queue performance every 10 seconds

// Graceful shutdown
const gracefulShutdown = () => {
  console.log("Gracefully shutting down the server...");

  // Wait for all queues to finish processing
  const queues = [mainQueue, usaQueue, europeQueue, indiaQueue];

  const waitForQueueDrain = async (queue) => {
    await queue.drain();
    console.log(`${queue.name} queue drained`);
  };

  Promise.all(queues.map(waitForQueueDrain))
    .then(() => {
      console.log("All queues drained. Shutting down...");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error during graceful shutdown:", error);
      process.exit(1);
    });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Create the 'queues' directory if it doesn't exist
const queuesDir = path.join(__dirname, "queues");
if (!fs.existsSync(queuesDir)) {
  fs.mkdirSync(queuesDir, { recursive: true });
}

module.exports = {
  app,
  mainQueue,
  usaQueue,
  europeQueue,
  indiaQueue,
};

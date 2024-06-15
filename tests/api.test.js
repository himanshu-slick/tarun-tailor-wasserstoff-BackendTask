const request = require("supertest");
const {
  app,
  mainQueue,
  usaQueue,
  europeQueue,
  indiaQueue,
} = require("../server");

describe("Server", () => {
  describe("Request Validation", () => {
    it("should return 400 for invalid requests", async () => {
      const response = await request(app)
        .post("/") // or any other route handled by the app
        .send({}); // Send an empty request body

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Invalid request");
    });

    it("should allow valid requests to pass", async () => {
      const response = await request(app)
        .post("/")
        .set("location", "USA") // Set the required 'location' header
        .send({ method: "GET", url: "/api/v1/resource" });

      expect(response.status).toBe(202);
      expect(response.body).toHaveProperty(
        "message",
        "Request queued for processing"
      );
    });
  });

  describe("Main Queue Processing", () => {
    it("should add requests to the main queue", (done) => {
      const method = "GET";
      const url = "/api/v1/resource";
      const location = "USA";
      const requestId = Date.now();

      mainQueue.add({ method, url, location, requestId }).then(() => {
        const mainQueueSize = mainQueue.size;
        expect(mainQueueSize).toBeGreaterThan(0);
        done();
      });
    });

    it("should distribute requests to regional queues based on location", async () => {
      const usaQueueSize = await usaQueue.size;
      const europeQueueSize = await europeQueue.size;
      const indiaQueueSize = await indiaQueue.size;

      await mainQueue.add({
        method: "GET",
        url: "/api/v1/resource",
        location: "USA",
        requestId: Date.now(),
      });

      const newUsaQueueSize = await usaQueue.size;
      const newEuropeQueueSize = await europeQueue.size;
      const newIndiaQueueSize = await indiaQueue.size;

      expect(newUsaQueueSize).toBeGreaterThan(usaQueueSize);
      expect(newEuropeQueueSize).toBe(europeQueueSize);
      expect(newIndiaQueueSize).toBe(indiaQueueSize);
    });
  });

  describe("Regional Queue Processing", () => {
    it("should process jobs from the USA queue", async () => {
      const method = "GET";
      const url = "/api/v1/resource";
      const requestId = Date.now();

      await usaQueue.add({ method, url, requestId });

      const initialUsaQueueSize = await usaQueue.size;

      // Simulate processing a job in the USA queue
      await new Promise((resolve) => {
        usaQueue.process(async (job, done) => {
          const { method, url, requestId } = job.data;
          // Mock API request handling
          done();
          resolve();
        });
      });

      const finalUsaQueueSize = await usaQueue.size;
      expect(finalUsaQueueSize).toBeLessThan(initialUsaQueueSize);
    }, 10000); // Set a higher timeout value (e.g., 10 seconds)
  });

  describe("Queue Performance Analysis", () => {
    it("should log queue sizes and logs", async () => {
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});

      // Add jobs to the queues
      await mainQueue.add({
        method: "GET",
        url: "/api/v1/resource",
        location: "USA",
        requestId: Date.now(),
      });
      await usaQueue.add({
        method: "GET",
        url: "/api/v1/resource",
        requestId: Date.now(),
      });
      await europeQueue.add({
        method: "GET",
        url: "/api/v1/resource",
        requestId: Date.now(),
      });
      await indiaQueue.add({
        method: "GET",
        url: "/api/v1/resource",
        requestId: Date.now(),
      });

      // Trigger the queue performance analysis
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          // Check if console.log was called with the expected output
          expect(consoleSpy).toHaveBeenCalledWith(
            "Queue performance analysis:"
          );
          expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining("Main queue size:")
          );
          expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining("USA queue size:")
          );
          expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining("Europe queue size:")
          );
          expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining("India queue size:")
          );
          expect(consoleSpy).toHaveBeenCalledWith("Queue logs:");

          consoleSpy.mockRestore();
          resolve();
        }, 20000); // Wait for the interval to trigger (20 seconds)
      });

      await timeoutPromise;
    }, 25000); // Set a higher timeout value (e.g., 25 seconds) // Set a higher timeout value (e.g., 15 seconds)
  });
});

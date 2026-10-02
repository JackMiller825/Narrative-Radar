import { beat, dueWorkspaceIds, runScan } from "@radar/db";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL;
const connection = redisUrl
  ? new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false, lazyConnect: true })
  : null;

const queue = connection
  ? new Queue("radar-scan", { connection })
  : null;

if (connection && queue) {
  connection.on("error", () => undefined);
  new Worker(
    "radar-scan",
    async (job: { data: { workspaceId: string } }) => {
      await runScan(job.data.workspaceId, "schedule");
    },
    { connection },
  );
  console.log("Narrative Radar worker queue is attached to Redis.");
} else {
  console.log("Narrative Radar worker is using the database lock loop because Redis is not configured.");
}

async function tick() {
  const redisUp = connection ? await probe() : false;
  await beat(redisUp ? "Queue worker is connected to Redis." : "Database schedule loop is running. Redis is not connected.");
  const due = await dueWorkspaceIds();
  for (const workspaceId of due) {
    if (redisUp && queue) {
      await queue.add("scan", { workspaceId }, { removeOnComplete: 50, removeOnFail: 20, jobId: `scan-${workspaceId}-${Date.now()}` });
    } else {
      await runScan(workspaceId, "schedule");
    }
  }
}

async function probe() {
  if (!connection) return false;
  try {
    if (connection.status === "wait") await connection.connect();
    const pong = await connection.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

await tick();
setInterval(() => {
  tick().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
  });
}, 5_000);

process.on("SIGTERM", () => process.exit(0));

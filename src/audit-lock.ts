import { mkdir, open, rm } from "node:fs/promises";

const RETRY_DELAY_MS = 10;
const LOCK_TIMEOUT_MS = 10_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withAuditLock<T>(
  filePath: string,
  operation: () => Promise<T>,
): Promise<T> {
  const lockPath = `${filePath}.lock`;

  await mkdir("audit", {
    recursive: true,
  });

  const start = Date.now();

  while (true) {
    try {
      const handle = await open(lockPath, "wx");

      await handle.close();

      break;
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "EEXIST"
      ) {
        throw error;
      }

      if (Date.now() - start >= LOCK_TIMEOUT_MS) {
        throw new Error(`Timed out acquiring audit lock: ${lockPath}`);
      }

      await sleep(RETRY_DELAY_MS);
    }
  }

  try {
    return await operation();
  } finally {
    await rm(lockPath, {
      force: true,
    });
  }
}

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",

    // ProofGate tests share the filesystem-backed audit chain.
    // Run test files sequentially to avoid cross-worker contention.
    fileParallelism: false,
  },
});

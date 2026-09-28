import { describe, expect, beforeEach, it } from "vitest";

import {
  hashRequest,
  getExecution,
  storeExecution,
  resetIdempotencyStore,
} from "../src/idempotency-store.js";

describe("Idempotency Store", () => {
  beforeEach(() => {
    resetIdempotencyStore();
  });

  it("generates the same hash for the same request", () => {
    const request = {
      action: "transfer_money",
      amount: 5000,
    };

    expect(hashRequest(request)).toBe(hashRequest({ ...request }));
  });

  it("generates different hashes for different requests", () => {
    const request1 = {
      action: "transfer_money",
      amount: 5000,
    };

    const request2 = {
      action: "transfer_money",
      amount: 6000,
    };

    expect(hashRequest(request1)).not.toBe(hashRequest(request2));
  });

  it("stores and retrieves an execution", () => {
    const result = {
      success: true,
      transferred: 5000,
    };

    storeExecution("key_123", {
      requestHash: hashRequest({
        action: "transfer_money",
        amount: 5000,
      }),
      result,
    });

    expect(getExecution("key_123")).toEqual({
      requestHash: hashRequest({
        action: "transfer_money",
        amount: 5000,
      }),
      result,
    });
  });

  it("returns undefined for an unknown key", () => {
    expect(getExecution("does_not_exist")).toBeUndefined();
  });
});

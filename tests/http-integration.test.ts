import { beforeEach, afterAll, describe, expect, it } from "vitest";
import { app } from "../src/server.js";
import { resetBank } from "../src/fake-bank.js";

describe("HTTP Integration", () => {
  beforeEach(() => {
    resetBank();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns health status", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/",
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      name: "ProofGate",
      status: "ok",
    });
  });

  it("allows a valid transfer through /verify", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/verify",
      payload: {
        action: "transfer_money",
        amount: 5000,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.verification.allowed).toBe(true);
    expect(body.verification.violations).toEqual([]);
    expect(body.executed).toBe(false);

    expect(body.trustedState).toEqual({
      balance: 20000,
      state_version: 1,
    });

    expect(body.proposedState).toEqual({
      action: "transfer_money",
      amount: 5000,
      balance: 20000,
      balance_after: 15000,
      state_version: 1,
    });
  });

  it("blocks an invalid transfer through /verify", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/verify",
      payload: {
        action: "transfer_money",
        amount: 15000,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.verification.allowed).toBe(false);
    expect(body.executed).toBe(false);

    expect(body.verification.violations).toEqual([
      {
        rule: "transfer_limit",
        reason: "Transfers cannot exceed ₹10,000.",
      },
    ]);
  });

  it("executes an allowed transfer through /execute", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/execute",
      payload: {
        action: "transfer_money",
        amount: 5000,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.verification.allowed).toBe(true);
    expect(body.executed).toBe(true);

    expect(body.executionResult).toEqual({
      success: true,
      transferred: 5000,
      remainingBalance: 15000,
    });
  });

  it("blocks a forbidden transfer before execution", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/execute",
      payload: {
        action: "transfer_money",
        amount: 20000,
      },
    });

    expect(response.statusCode).toBe(403);

    const body = response.json();

    expect(body.verification.allowed).toBe(false);
    expect(body.executed).toBe(false);
    expect(body.executionResult).toBeUndefined();

    expect(body.verification.violations).toEqual([
      {
        rule: "transfer_limit",
        reason: "Transfers cannot exceed ₹10,000.",
      },
      {
        rule: "minimum_remaining_balance",
        reason: "At least ₹1,000 must remain after the transfer.",
      },
    ]);
  });

  it("rejects an invalid request", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/execute",
      payload: {
        action: "transfer_money",
        amount: -500,
      },
    });

    expect(response.statusCode).toBe(400);
  });
});

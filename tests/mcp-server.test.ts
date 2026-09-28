import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Client, InMemoryTransport } from "@modelcontextprotocol/client";

import { createServer } from "../src/mcp-server.js";
import { resetBank } from "../src/fake-bank.js";
import { resetPayments } from "../src/fake-payments.js";

describe("MCP Server", () => {
  let client: Client;
  let server: ReturnType<typeof createServer>;

  beforeEach(async () => {
    resetBank();
    resetPayments();

    server = createServer();

    client = new Client({
      name: "proofgate-test-client",
      version: "1.0.0",
    });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  it("exposes ProofGate tools through MCP", async () => {
    const result = await client.listTools();

    const toolNames = result.tools.map((tool) => tool.name);

    expect(toolNames).toContain("transfer_money");
    expect(toolNames).toContain("refund_payment");
  });

  it("executes an allowed transfer through ProofGate", async () => {
    const result = await client.callTool({
      name: "transfer_money",
      arguments: {
        amount: 5000,
      },
    });

    expect(result.isError).not.toBe(true);

    const content = result.content;

    expect(content).toHaveLength(1);

    const firstContent = content[0];

    expect(firstContent).toBeDefined();
    expect(firstContent?.type).toBe("text");

    if (firstContent?.type !== "text") {
      throw new Error("Expected MCP response content to be text.");
    }

    const body = JSON.parse(firstContent.text);

    expect(body.verification.allowed).toBe(true);
    expect(body.executed).toBe(true);

    expect(body.executionResult).toEqual({
      success: true,
      transferred: 5000,
      remainingBalance: 15000,
    });
  });

  it("blocks a forbidden transfer before execution", async () => {
    const result = await client.callTool({
      name: "transfer_money",
      arguments: {
        amount: 15000,
      },
    });

    expect(result.isError).toBe(true);

    const content = result.content;

    expect(content).toHaveLength(1);

    const firstContent = content[0];

    expect(firstContent).toBeDefined();

    if (firstContent?.type !== "text") {
      throw new Error("Expected MCP response content to be text.");
    }

    const body = JSON.parse(firstContent.text);

    expect(body.verification.allowed).toBe(false);
    expect(body.executed).toBe(false);
    expect(body.executionResult).toBeUndefined();

    expect(body.verification.violations).toEqual([
      {
        rule: "transfer_limit",
        reason: "Transfers cannot exceed ₹10,000.",
      },
    ]);
  });

  it("executes an allowed refund through ProofGate", async () => {
    const result = await client.callTool({
      name: "refund_payment",
      arguments: {
        paymentId: "payment_001",
        amount: 3000,
      },
    });

    expect(result.isError).not.toBe(true);

    const content = result.content;

    expect(content).toHaveLength(1);

    const firstContent = content[0];

    expect(firstContent).toBeDefined();

    if (firstContent?.type !== "text") {
      throw new Error("Expected MCP response content to be text.");
    }

    const body = JSON.parse(firstContent.text);

    expect(body.verification.allowed).toBe(true);
    expect(body.executed).toBe(true);

    expect(body.executionResult).toEqual({
      success: true,
      paymentId: "payment_001",
      refunded: 3000,
      originalPaymentAmount: 5000,
      status: "refunded",
    });
  });

  it("blocks a refund exceeding the original payment", async () => {
    const result = await client.callTool({
      name: "refund_payment",
      arguments: {
        paymentId: "payment_001",
        amount: 6000,
      },
    });

    expect(result.isError).toBe(true);

    const content = result.content;

    expect(content).toHaveLength(1);

    const firstContent = content[0];

    expect(firstContent).toBeDefined();

    if (firstContent?.type !== "text") {
      throw new Error("Expected MCP response content to be text.");
    }

    const body = JSON.parse(firstContent.text);

    expect(body.verification.allowed).toBe(false);
    expect(body.executed).toBe(false);
    expect(body.executionResult).toBeUndefined();

    expect(body.verification.violations).toEqual([
      {
        rule: "refund_limit",
        reason: "Refund cannot exceed the original payment amount.",
      },
    ]);
  });

  it("blocks a refund for a non-paid payment", async () => {
    const result = await client.callTool({
      name: "refund_payment",
      arguments: {
        paymentId: "payment_003",
        amount: 1000,
      },
    });

    expect(result.isError).toBe(true);

    const content = result.content;

    expect(content).toHaveLength(1);

    const firstContent = content[0];

    expect(firstContent).toBeDefined();

    if (firstContent?.type !== "text") {
      throw new Error("Expected MCP response content to be text.");
    }

    const body = JSON.parse(firstContent.text);

    expect(body.verification.allowed).toBe(false);
    expect(body.executed).toBe(false);
    expect(body.executionResult).toBeUndefined();

    expect(body.verification.violations).toEqual([
      {
        rule: "payment_must_be_paid",
        reason: "Only paid payments can be refunded.",
      },
    ]);
  });
});

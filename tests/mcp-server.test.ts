import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createServer } from "../src/mcp-server.js";
import { resetBank } from "../src/fake-bank.js";
import { resetPayments } from "../src/fake-payments.js";
import { toolRegistry } from "../src/tool-registry-instance.js";
import { resetNotifications } from "../src/fake-notifications.js";
import { resetExternalInvoices } from "../src/external/invoice-service.js";

describe("MCP Server", () => {
  let client: Client;
  let server: ReturnType<typeof createServer>;

  beforeEach(async () => {
    resetBank();
    resetPayments();
    resetNotifications();
    resetExternalInvoices();

    server = createServer();

    client = new Client({
      name: "ProofGate-MCP-Client",
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

    expect(result.isError).not.toBe(true);

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

    expect(result.isError).not.toBe(true);

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

    expect(result.isError).not.toBe(true);

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

  it("exposes all registered ProofGate tools through MCP", async () => {
    const result = await client.listTools();

    const registeredTools = toolRegistry.getTools();

    expect(result.tools).toHaveLength(registeredTools.length);

    for (const registeredTool of registeredTools) {
      const mcpTool = result.tools.find(
        (tool) => tool.name === registeredTool.name,
      );

      expect(mcpTool).toBeDefined();

      expect(mcpTool?.description).toBe(registeredTool.description);

      expect(mcpTool?.inputSchema).toBeDefined();
    }
  });

  it("executes a non-financial registered tool through MCP", async () => {
    const result = await client.callTool({
      name: "send_notification",
      arguments: {
        recipient: "user@example.com",
        message: "ProofGate is working.",
      },
    });

    const content = result.content;

    expect(content).toHaveLength(1);

    const firstContent = content[0];

    expect(firstContent).toBeDefined();

    if (firstContent?.type !== "text") {
      throw new Error("Expected MCP response content to be text.");
    }

    const body = JSON.parse(firstContent.text);

    expect(result.isError).not.toBe(true);

    expect(body.verification.allowed).toBe(true);
    expect(body.verification.violations).toEqual([]);

    expect(body.executed).toBe(true);

    expect(body.executionResult).toEqual({
      success: true,
      id: "notification_1",
      recipient: "user@example.com",
      message: "ProofGate is working.",
    });
  });

  it("blocks notification to an unauthorized recipient", async () => {
    const result = await client.callTool({
      name: "send_notification",
      arguments: {
        recipient: "attacker@example.com",
        message: "This should be blocked.",
      },
    });

    const content = result.content;

    expect(content).toHaveLength(1);

    const firstContent = content[0];

    expect(firstContent).toBeDefined();

    if (firstContent?.type !== "text") {
      throw new Error("Expected MCP response content to be text.");
    }

    const body = JSON.parse(firstContent.text);

    expect(result.isError).not.toBe(true);

    expect(body.verification.allowed).toBe(false);

    expect(body.verification.violations).toEqual([
      {
        rule: "notification_recipient_authorized",
        reason: "Notifications can only be sent to authorized recipients.",
      },
    ]);

    expect(body.executed).toBe(false);
    expect(body.executionResult).toBeUndefined();
  });

  it("rejects caller-supplied trusted authorization state", async () => {
    const result = await client.callTool({
      name: "send_notification",
      arguments: {
        recipient: "attacker@example.com",
        message: "This should never execute.",
        recipient_authorized: true,
      },
    });

    const content = result.content;

    expect(content).toHaveLength(1);

    const firstContent = content[0];

    expect(firstContent).toBeDefined();

    if (firstContent?.type !== "text") {
      throw new Error("Expected MCP response content to be text.");
    }

    expect(result.isError).toBe(true);

    expect(firstContent.text).toContain("Input validation error");

    expect(firstContent.text).toContain("recipient_authorized");
  });

  it("executes an allowed invoice through ProofGate", async () => {
    const result = await client.callTool({
      name: "create_invoice",
      arguments: {
        amount: 20_000,
        currency: "INR",
        customerStatus: "active",
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
    expect(body.verification.violations).toEqual([]);

    expect(body.executed).toBe(true);

    expect(body.executionResult).toEqual({
      success: true,
      invoiceId: "external_invoice_1",
      amount: 20_000,
      currency: "INR",
    });
  });

  it("blocks an invalid invoice through ProofGate", async () => {
    const result = await client.callTool({
      name: "create_invoice",
      arguments: {
        amount: 60_000,
        currency: "INR",
        customerStatus: "active",
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

    expect(body.verification.allowed).toBe(false);
    expect(body.executed).toBe(false);
    expect(body.executionResult).toBeUndefined();

    expect(body.verification.violations).toEqual([
      {
        rule: "invoice_amount_limit",
        reason: "Invoices cannot exceed ₹50,000.",
      },
    ]);
  });

  it("blocks an invoice for an inactive customer through MCP", async () => {
    const result = await client.callTool({
      name: "create_invoice",
      arguments: {
        amount: 20_000,
        currency: "INR",
        customerStatus: "inactive",
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

    expect(body.verification.allowed).toBe(false);
    expect(body.executed).toBe(false);

    expect(body.verification.violations).toEqual([
      {
        rule: "customer_must_be_active",
        reason: "Invoices can only be created for active customers.",
      },
    ]);
  });

  it("blocks a non-INR invoice through MCP", async () => {
    const result = await client.callTool({
      name: "create_invoice",
      arguments: {
        amount: 20_000,
        currency: "USD",
        customerStatus: "active",
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

    expect(body.verification.allowed).toBe(false);
    expect(body.executed).toBe(false);

    expect(body.verification.violations).toEqual([
      {
        rule: "currency_must_be_inr",
        reason: "Invoices must use INR.",
      },
    ]);
  });
});

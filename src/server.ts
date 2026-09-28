import Fastify from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { verify, execute } from "./proofgate.js";

export const app = Fastify({
  logger: true,
});

const ActionRequest = z
  .object({
    action: z.string(),
    environment: z.enum(["development", "staging", "production"]).optional(),
    amount: z.number().optional(),
    paymentId: z.string().optional(),
  })
  .strict();

app.get("/", async () => {
  return {
    name: "ProofGate",
    status: "ok",
  };
});

app.post("/verify", async (req, reply) => {
  const parsed = ActionRequest.safeParse(req.body);

  if (!parsed.success) {
    return reply.code(400).send({
      error: "Invalid request",
      details: parsed.error.issues,
    });
  }

  const traceId = `pg_${randomUUID()}`;

  try {
    const result = await verify(parsed.data, traceId);

    return reply.send(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return reply.code(400).send({
      traceId,
      error: message,
    });
  }
});

app.post("/execute", async (req, reply) => {
  const parsed = ActionRequest.safeParse(req.body);

  if (!parsed.success) {
    return reply.code(400).send({
      error: "Invalid request",
      details: parsed.error.issues,
    });
  }

  const traceId = `pg_${randomUUID()}`;

  try {
    const result = await execute(parsed.data, traceId);

    if (!result.verification.allowed) {
      return reply.code(403).send(result);
    }

    if (result.executionError) {
      return reply.code(500).send(result);
    }

    return reply.send(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return reply.code(400).send({
      traceId,
      error: message,
    });
  }
});

export async function startServer() {
  await app
    .listen({
      host: "127.0.0.1",
      port: 3000,
    })
    .then(() => {
      console.log("ProofGate running on http://127.0.0.1:3000");
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

if (process.argv[1]?.endsWith("server.ts")) {
  await startServer();
}

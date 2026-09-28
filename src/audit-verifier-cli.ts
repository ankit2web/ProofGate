import { verifyAuditLog } from "./audit-verifier.js";

const filePath = "audit/events.jsonl";

try {
  const result = await verifyAuditLog(filePath);

  console.log("");
  console.log("ProofGate Audit Chain");
  console.log("---------------------");
  console.log(`File: ${filePath}`);
  console.log(`Events: ${result.events}`);

  if (result.valid) {
    console.log("Status: VALID");
    console.log("Chain: ✓");
    process.exit(0);
  }

  console.error("Status: INVALID");
  console.error("Chain: ✗");
  process.exit(1);
} catch (error) {
  console.error("");
  console.error("ProofGate Audit Chain");
  console.error("---------------------");
  console.error("Status: ERROR");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exit(1);
}

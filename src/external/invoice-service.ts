export type Invoice = {
  id: string;
  amount: number;
  currency: string;
};

const invoices: Invoice[] = [];

const idempotencyResults = new Map<string, Invoice>();

let shouldFail = false;

let executionDelayMs = 0;

export async function createExternalInvoice(
  amount: number,
  currency: string,
  idempotencyKey?: string,
): Promise<Invoice> {
  if (shouldFail) {
    throw new Error("External invoice service unavailable.");
  }

  /*
   * Simulate network/provider latency.
   */
  if (executionDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, executionDelayMs));
  }

  /*
   * Provider-level idempotency.
   *
   * If this provider has already processed this key,
   * return the original invoice instead of creating
   * another side effect.
   */
  if (idempotencyKey) {
    const existing = idempotencyResults.get(idempotencyKey);

    if (existing) {
      return { ...existing };
    }
  }

  const invoice: Invoice = {
    id: `external_invoice_${invoices.length + 1}`,
    amount,
    currency,
  };

  invoices.push(invoice);

  /*
   * Persist the provider's knowledge of the operation.
   */
  if (idempotencyKey) {
    idempotencyResults.set(idempotencyKey, invoice);
  }

  return { ...invoice };
}

export function resetExternalInvoices() {
  invoices.length = 0;
  idempotencyResults.clear();

  shouldFail = false;
  executionDelayMs = 0;
}

export function setExternalInvoiceFailure(value: boolean) {
  shouldFail = value;
}

export function setExternalInvoiceExecutionDelay(milliseconds: number) {
  executionDelayMs = milliseconds;
}

export function getExternalInvoices() {
  return invoices.map((invoice) => ({
    ...invoice,
  }));
}

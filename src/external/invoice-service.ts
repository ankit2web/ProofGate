export type Invoice = {
  id: string;
  amount: number;
  currency: string;
};

const invoices: Invoice[] = [];

let shouldFail = false;

export async function createExternalInvoice(
  amount: number,
  currency: string,
): Promise<Invoice> {
  if (shouldFail) {
    throw new Error("External invoice service unavailable.");
  }

  if (executionDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, executionDelayMs));
  }

  const invoice: Invoice = {
    id: `external_invoice_${invoices.length + 1}`,
    amount,
    currency,
  };

  invoices.push(invoice);

  return invoice;
}

export function resetExternalInvoices() {
  invoices.length = 0;
  shouldFail = false;
  executionDelayMs = 0;
}

export function setExternalInvoiceFailure(value: boolean) {
  shouldFail = value;
}

export function getExternalInvoices() {
  return [...invoices];
}

let executionDelayMs = 0;

export function setExternalInvoiceExecutionDelay(milliseconds: number) {
  executionDelayMs = milliseconds;
}

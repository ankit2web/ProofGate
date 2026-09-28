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
}

export function setExternalInvoiceFailure(value: boolean) {
  shouldFail = value;
}

export function getExternalInvoices() {
  return [...invoices];
}

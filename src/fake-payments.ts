type Payment = {
  id: string;
  amount: number;
  status: "paid" | "refunded";
};

const payments = new Map<string, Payment>([
  [
    "payment_001",
    {
      id: "payment_001",
      amount: 5000,
      status: "paid",
    },
  ],
  [
    "payment_002",
    {
      id: "payment_002",
      amount: 10000,
      status: "paid",
    },
  ],
  [
    "payment_003",
    {
      id: "payment_003",
      amount: 3000,
      status: "refunded",
    },
  ],
]);

export function getPayment(
  paymentId: string,
) {
  const payment = payments.get(paymentId);

  if (!payment) {
    throw new Error(
      `Payment not found: ${paymentId}`,
    );
  }

  return {
    ...payment,
  };
}

export function refundPayment(
  paymentId: string,
  amount: number,
) {
  const payment = payments.get(paymentId);

  if (!payment) {
    throw new Error(
      `Payment not found: ${paymentId}`,
    );
  }

  if (payment.status !== "paid") {
    throw new Error(
      `Payment cannot be refunded. Current status: ${payment.status}`,
    );
  }

  if (amount <= 0) {
    throw new Error(
      "Refund amount must be positive.",
    );
  }

  if (amount > payment.amount) {
    throw new Error(
      "Refund amount cannot exceed payment amount.",
    );
  }

  payment.status = "refunded";

  return {
    success: true,
    paymentId,
    refunded: amount,
    originalPaymentAmount:
      payment.amount,
    status: payment.status,
  };
}
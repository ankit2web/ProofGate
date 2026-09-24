let balance = 20000;

export function getBalance() {
  return balance;
}

export function transfer(amount: number) {
  if (amount <= 0) {
    throw new Error("Transfer amount must be positive.");
  }

  if (amount > balance) {
    throw new Error("Insufficient bank balance.");
  }

  balance -= amount;

  return {
    success: true,
    transferred: amount,
    remainingBalance: balance,
  };
}
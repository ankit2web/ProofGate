let balance = 20000;
let stateVersion = 1;

export function getBankState() {
  return {
    balance,
    state_version: stateVersion,
  };
}

export function getBalance() {
  return balance;
}

export function transfer(amount: number, expectedStateVersion?: number) {
  if (amount <= 0) {
    throw new Error("Transfer amount must be positive.");
  }

  if (
    expectedStateVersion !== undefined &&
    stateVersion !== expectedStateVersion
  ) {
    throw new Error(
      `Bank state changed after verification. Expected version ${expectedStateVersion}, actual version ${stateVersion}.`,
    );
  }

  if (amount > balance) {
    throw new Error("Insufficient bank balance.");
  }

  balance -= amount;
  stateVersion += 1;

  return {
    success: true,
    transferred: amount,
    remainingBalance: balance,
  };
}

export function resetBank() {
  balance = 20000;
  stateVersion = 1;
}

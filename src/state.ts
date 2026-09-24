export function calculateAfterState(
  request: Record<string, unknown>,
) {
  const state = {
    ...request,
  };

  if (
    request.action === "transfer_money" &&
    typeof request.balance === "number" &&
    typeof request.amount === "number"
  ) {
    state.balance_after =
      request.balance - request.amount;
  }

  return state;
}
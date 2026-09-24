export function calculateAfterState(
  request: Record<string, unknown>,
  trustedState: Record<string, unknown>,
) {
  const state = {
    ...request,
    ...trustedState,
  };

  if (
    request.action === "transfer_money" &&
    typeof trustedState.balance === "number" &&
    typeof request.amount === "number"
  ) {
    state.balance_after =
      trustedState.balance - request.amount;
  }

  return state;
}
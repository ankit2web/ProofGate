import { getBalance } from "./fake-bank.js";

export async function getTrustedState(
  request: Record<string, unknown>,
) {
  switch (request.action) {
    case "transfer_money":
      return {
        balance: getBalance(),
      };

    default:
      return {};
  }
}
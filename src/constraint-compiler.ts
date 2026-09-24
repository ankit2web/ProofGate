import type { Context } from "z3-solver";

export function compileConstraint(
  Z3: Context,
  condition: string,
  values: Record<string, unknown>,
) {
  /*
   * For now we support simple expressions:
   *
   * amount <= 10000
   * amount >= 100
   * balance >= amount
   * daily_spend + amount <= daily_limit
   */

  const match = condition.match(
    /^([a-zA-Z_][a-zA-Z0-9_]*)\s*(<=|>=|==|!=|<|>)\s*(.+)$/,
  );

  if (!match) {
    throw new Error(
      `Unsupported constraint: ${condition}`,
    );
  }

  const [, leftName, operator, rightRaw] = match;

  const left = Z3.Real.const(leftName!);

  const rightValue = resolveValue(
    Z3,
    rightRaw!.trim(),
    values,
  );

  switch (operator) {
    case "<=":
      return left.le(rightValue);

    case ">=":
      return left.ge(rightValue);

    case "<":
      return left.lt(rightValue);

    case ">":
      return left.gt(rightValue);

    case "==":
      return left.eq(rightValue);

    case "!=":
      return left.neq(rightValue);

    default:
      throw new Error(
        `Unsupported operator: ${operator}`,
      );
  }
}

function resolveValue(
  Z3: Context,
  value: string,
  values: Record<string, unknown>,
) {
  // Number literal
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Z3.Real.val(value);
  }

  // Another request variable
  if (value in values) {
    return Z3.Real.const(value);
  }

  throw new Error(
    `Unknown value in constraint: ${value}`,
  );
}
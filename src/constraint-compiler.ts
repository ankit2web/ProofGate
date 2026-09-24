import type { Context } from "z3-solver";

type Z3Value = any;

type Token =
  | {
    type: "number";
    value: string;
  }
  | {
    type: "identifier";
    value: string;
  }
  | {
    type: "operator";
    value: string;
  }
  | {
    type: "leftParen";
    value: "(";
  }
  | {
    type: "rightParen";
    value: ")";
  };

const COMPARISON_OPERATORS = [
  "<=",
  ">=",
  "==",
  "!=",
  "<",
  ">",
];

const ARITHMETIC_OPERATORS = [
  "+",
  "-",
  "*",
  "/",
];

/**
 * Compile a safe mathematical policy condition into Z3.
 *
 * Examples:
 *
 * amount <= 10000
 * balance >= amount
 * balance - amount >= 1000
 * daily_spend + amount <= daily_limit
 * quantity * price <= budget
 * (balance - amount) >= 1000
 */
export function compileConstraint(
  Z3: Context,
  condition: string,
  values: Record<string, unknown>,
) {
  const tokens = tokenize(condition);

  const comparisonIndex = tokens.findIndex(
    (token) =>
      token.type === "operator" &&
      COMPARISON_OPERATORS.includes(token.value),
  );

  if (comparisonIndex === -1) {
    throw new Error(
      `Constraint must contain a comparison operator: ${condition}`,
    );
  }

  if (
    tokens.filter(
      (token) =>
        token.type === "operator" &&
        COMPARISON_OPERATORS.includes(token.value),
    ).length !== 1
  ) {
    throw new Error(
      `Constraint must contain exactly one comparison operator: ${condition}`,
    );
  }

  const leftTokens = tokens.slice(
    0,
    comparisonIndex,
  );

  const rightTokens = tokens.slice(
    comparisonIndex + 1,
  );

  if (leftTokens.length === 0) {
    throw new Error(
      `Missing left-hand expression: ${condition}`,
    );
  }

  if (rightTokens.length === 0) {
    throw new Error(
      `Missing right-hand expression: ${condition}`,
    );
  }

  const left = parseArithmeticExpression(
    Z3,
    leftTokens,
    values,
  );

  const right = parseArithmeticExpression(
    Z3,
    rightTokens,
    values,
  );

  const comparisonToken =
    tokens[comparisonIndex];

  if (!comparisonToken) {
    throw new Error(
      `Missing comparison operator: ${condition}`,
    );
  }

  const operator = comparisonToken.value;

  switch (operator) {
    case "<=":
      return left.le(right);

    case ">=":
      return left.ge(right);

    case "<":
      return left.lt(right);

    case ">":
      return left.gt(right);

    case "==":
      return left.eq(right);

    case "!=":
      return left.neq(right);

    default:
      throw new Error(
        `Unsupported comparison operator: ${operator}`,
      );
  }
}

/*
 * ============================================================
 * Tokenizer
 * ============================================================
 */

function tokenize(
  expression: string,
): Token[] {
  const tokens: Token[] = [];

  let index = 0;

  while (index < expression.length) {
    const char = expression[index];

    if (char === undefined) {
      throw new Error(
        "Unexpected end of expression.",
      );
    }

    /*
     * Ignore whitespace.
     */
    if (/\s/.test(char)) {
      index++;
      continue;
    }

    /*
     * Numbers.
     */
    if (/[0-9.]/.test(char)) {
      const start = index;

      let dotCount = 0;

      while (index < expression.length) {
        const currentChar =
          expression[index];

        if (
          currentChar === undefined ||
          !/[0-9.]/.test(currentChar)
        ) {
          break;
        }

        if (currentChar === ".") {
          dotCount++;
        }

        index++;
      }

      const value = expression.slice(
        start,
        index,
      );

      if (dotCount > 1 || value === ".") {
        throw new Error(
          `Invalid number: ${value}`,
        );
      }

      tokens.push({
        type: "number",
        value,
      });

      continue;
    }

    /*
     * Identifiers.
     *
     * Example:
     *
     * amount
     * balance
     * daily_limit
     */
    if (/[a-zA-Z_]/.test(char)) {
      const start = index;

      index++;

      while (index < expression.length) {
        const currentChar =
          expression[index];

        if (
          currentChar === undefined ||
          !/[a-zA-Z0-9_]/.test(currentChar)
        ) {
          break;
        }

        index++;
      }

      tokens.push({
        type: "identifier",
        value: expression.slice(
          start,
          index,
        ),
      });

      continue;
    }

    /*
     * Two-character comparison operators.
     */
    const twoCharacterOperator =
      expression.slice(index, index + 2);

    if (
      ["<=", ">=", "==", "!="].includes(
        twoCharacterOperator,
      )
    ) {
      tokens.push({
        type: "operator",
        value: twoCharacterOperator,
      });

      index += 2;

      continue;
    }

    /*
     * Arithmetic operators.
     */
    if (
      ARITHMETIC_OPERATORS.includes(char)
    ) {
      tokens.push({
        type: "operator",
        value: char,
      });

      index++;

      continue;
    }

    /*
     * Single-character comparisons.
     */
    if (["<", ">"].includes(char)) {
      tokens.push({
        type: "operator",
        value: char,
      });

      index++;

      continue;
    }

    /*
     * Parentheses.
     */
    if (char === "(") {
      tokens.push({
        type: "leftParen",
        value: "(",
      });

      index++;

      continue;
    }

    if (char === ")") {
      tokens.push({
        type: "rightParen",
        value: ")",
      });

      index++;

      continue;
    }

    throw new Error(
      `Invalid character in constraint: "${char}"`,
    );
  }

  return tokens;
}

/*
 * ============================================================
 * Arithmetic Parser
 * ============================================================
 *
 * Grammar:
 *
 * expression
 *   → term ((+ | -) term)*
 *
 * term
 *   → unary ((* | /) unary)*
 *
 * unary
 *   → - unary
 *   → primary
 *
 * primary
 *   → number
 *   → identifier
 *   → "(" expression ")"
 *
 * This gives us normal mathematical precedence:
 *
 * multiplication/division
 * before
 * addition/subtraction.
 */

function parseArithmeticExpression(
  Z3: Context,
  tokens: Token[],
  values: Record<string, unknown>,
): Z3Value {
  let position = 0;

  function current(): Token | undefined {
    return tokens[position];
  }

  function consume(): Token {
    const token = current();

    if (!token) {
      throw new Error(
        "Unexpected end of expression.",
      );
    }

    position++;

    return token;
  }

  function parseExpression(): Z3Value {
    let left = parseTerm();

    while (true) {
      const token = current();

      if (
        !token ||
        token.type !== "operator" ||
        !["+", "-"].includes(token.value)
      ) {
        break;
      }

      consume();

      const right = parseTerm();

      if (token.value === "+") {
        left = left.add(right);
      } else {
        left = left.sub(right);
      }
    }

    return left;
  }

  function parseTerm(): Z3Value {
    let left = parseUnary();

    while (true) {
      const token = current();

      if (
        !token ||
        token.type !== "operator" ||
        !["*", "/"].includes(token.value)
      ) {
        break;
      }

      consume();

      const right = parseUnary();

      if (token.value === "*") {
        left = left.mul(right);
      } else {
        left = left.div(right);
      }
    }

    return left;
  }

  function parseUnary(): Z3Value {
    const token = current();

    if (
      token?.type === "operator" &&
      token.value === "-"
    ) {
      consume();

      return parseUnary().neg();
    }

    return parsePrimary();
  }

  function parsePrimary(): Z3Value {
    const token = consume();

    if (token.type === "number") {
      return Z3.Real.val(token.value);
    }

    if (token.type === "identifier") {
      if (!(token.value in values)) {
        throw new Error(
          `Unknown value in constraint: ${token.value}`,
        );
      }

      if (
        typeof values[token.value] !== "number"
      ) {
        throw new Error(
          `Constraint value must be numeric: ${token.value}`,
        );
      }

      return Z3.Real.const(token.value);
    }

    if (token.type === "leftParen") {
      const expression =
        parseExpression();

      const closing = current();

      if (
        !closing ||
        closing.type !== "rightParen"
      ) {
        throw new Error(
          "Missing closing parenthesis in constraint.",
        );
      }

      consume();

      return expression;
    }

    throw new Error(
      `Unexpected token: ${token.value}`,
    );
  }

  const result = parseExpression();

  if (position !== tokens.length) {
    const unexpectedToken =
      tokens[position];

    if (!unexpectedToken) {
      throw new Error(
        "Unexpected end of expression.",
      );
    }

    throw new Error(
      `Unexpected token: ${unexpectedToken.value}`,
    );
  }

  return result;
}
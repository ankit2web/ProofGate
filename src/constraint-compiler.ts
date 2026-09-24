import type { Context } from "z3-solver";

type Z3Value = any;

type Token =
  | { type: "number"; value: string }
  | { type: "string"; value: string }
  | { type: "boolean"; value: boolean }
  | { type: "identifier"; value: string }
  | { type: "operator"; value: string }
  | { type: "leftParen"; value: "(" }
  | { type: "rightParen"; value: ")" };

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

function tokenize(condition: string): Token[] {
  const tokens: Token[] = [];

  let index = 0;

  while (index < condition.length) {
    const char = condition[index]!;

    if (char === undefined) {
      throw new Error("Unexpected end of condition.");
    }

    if (/\s/.test(char)) {
      index++;
      continue;
    }

    /*
     * String literal
     *
     * Example:
     * "paid"
     */
    if (char === '"') {
      index++;

      let value = "";

      while (
        index < condition.length &&
        condition[index] !== '"'
      ) {
        value += condition[index];
        index++;
      }

      if (index >= condition.length) {
        throw new Error(
          "Unterminated string literal.",
        );
      }

      index++;

      tokens.push({
        type: "string",
        value,
      });

      continue;
    }

    /*
     * Number
     */
    if (/[0-9.]/.test(char)) {
      let value = "";

      while (
        index < condition.length &&
        /[0-9.]/.test(condition[index]!)
      ) {
        value += condition[index];
        index++;
      }

      if (
        value === "." ||
        value.split(".").length > 2
      ) {
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
     * Identifier / boolean
     */
    if (/[A-Za-z_]/.test(char)) {
      let value = "";

      while (
        index < condition.length &&
        /[A-Za-z0-9_]/.test(condition[index]!)
      ) {
        value += condition[index];
        index++;
      }

      if (value === "true") {
        tokens.push({
          type: "boolean",
          value: true,
        });
      } else if (value === "false") {
        tokens.push({
          type: "boolean",
          value: false,
        });
      } else {
        tokens.push({
          type: "identifier",
          value,
        });
      }

      continue;
    }

    /*
     * Parentheses
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

    /*
     * Two-character operators
     */
    const twoCharacterOperator =
      condition.slice(index, index + 2);

    if (
      COMPARISON_OPERATORS.includes(
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
     * Single-character operators
     */
    if (
      [
        ...ARITHMETIC_OPERATORS,
        "<",
        ">",
      ].includes(char)
    ) {
      tokens.push({
        type: "operator",
        value: char,
      });

      index++;
      continue;
    }

    throw new Error(
      `Invalid character in condition: ${char}`,
    );
  }

  return tokens;
}

class Parser {
  private index = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly Z3: Context,
    private readonly values: Record<
      string,
      unknown
    >,
  ) { }

  private current(): Token | undefined {
    return this.tokens[this.index];
  }

  private consume(): Token {
    const token = this.current();

    if (!token) {
      throw new Error(
        "Unexpected end of condition.",
      );
    }

    this.index++;

    return token;
  }

  private expectOperator(
    operator: string,
  ) {
    const token = this.consume();

    if (
      token.type !== "operator" ||
      token.value !== operator
    ) {
      throw new Error(
        `Expected operator "${operator}".`,
      );
    }
  }

  parse(): Z3Value {
    const result = this.parseComparison();

    if (this.current()) {
      throw new Error(
        `Unexpected token: ${this.current()!.value}`,
      );
    }

    return result;
  }

  /*
   * comparison
   *
   * expression:
   * amount <= payment_amount
   * payment_status == "paid"
   */
  private parseComparison(): Z3Value {
    let left = this.parseExpression();

    const token = this.current();

    if (
      token?.type === "operator" &&
      COMPARISON_OPERATORS.includes(
        token.value,
      )
    ) {
      const operator = this.consume().value;

      const right =
        this.parseExpression();

      switch (operator) {
        case "<=":
          return left.le(right);

        case ">=":
          return left.ge(right);

        case "==":
          return left.eq(right);

        case "!=":
          return left.neq(right);

        case "<":
          return left.lt(right);

        case ">":
          return left.gt(right);

        default:
          throw new Error(
            `Unsupported comparison operator: ${operator}`,
          );
      }
    }

    return left;
  }

  /*
   * expression
   *
   * addition/subtraction
   */
  private parseExpression(): Z3Value {
    let left = this.parseTerm();

    while (true) {
      const token = this.current();

      if (
        token?.type !== "operator" ||
        (token.value !== "+" &&
          token.value !== "-")
      ) {
        break;
      }

      const operator = this.consume().value;

      const right = this.parseTerm();

      if (operator === "+") {
        left = left.add(right);
      } else {
        left = left.sub(right);
      }
    }

    return left;
  }

  /*
   * term
   *
   * multiplication/division
   */
  private parseTerm(): Z3Value {
    let left = this.parseUnary();

    while (true) {
      const token = this.current();

      if (
        token?.type !== "operator" ||
        (token.value !== "*" &&
          token.value !== "/")
      ) {
        break;
      }

      const operator = this.consume().value;

      const right = this.parseUnary();

      if (operator === "*") {
        left = left.mul(right);
      } else {
        left = left.div(right);
      }
    }

    return left;
  }

  /*
   * unary
   */
  private parseUnary(): Z3Value {
    const token = this.current();

    if (
      token?.type === "operator" &&
      token.value === "-"
    ) {
      this.consume();

      return this.parseUnary().neg();
    }

    return this.parsePrimary();
  }

  /*
   * primary
   */
  private parsePrimary(): Z3Value {
    const token = this.consume();

    if (token.type === "number") {
      return this.Z3.Real.val(
        token.value,
      );
    }

    if (token.type === "string") {
      return this.Z3.String.val(
        token.value,
      );
    }

    if (token.type === "boolean") {
      return this.Z3.Bool.val(
        token.value,
      );
    }

    if (token.type === "identifier") {
      if (!(token.value in this.values)) {
        throw new Error(
          `Unknown value in constraint: ${token.value}`,
        );
      }

      const value =
        this.values[token.value];

      if (typeof value === "number") {
        return this.Z3.Real.const(
          token.value,
        );
      }

      if (typeof value === "string") {
        return this.Z3.String.const(
          token.value,
        );
      }

      if (typeof value === "boolean") {
        return this.Z3.Bool.const(
          token.value,
        );
      }

      throw new Error(
        `Unsupported value type for variable: ${token.value}`,
      );
    }

    if (token.type === "leftParen") {
      const result =
        this.parseComparison();

      const closing = this.consume();

      if (
        closing.type !== "rightParen"
      ) {
        throw new Error(
          'Expected ")".',
        );
      }

      return result;
    }

    throw new Error(
      `Unexpected token: ${token.value}`,
    );
  }
}

export function compileConstraint(
  Z3: Context,
  condition: string,
  values: Record<string, unknown>,
) {
  const tokens = tokenize(condition);

  const parser = new Parser(
    tokens,
    Z3,
    values,
  );

  return parser.parse();
}
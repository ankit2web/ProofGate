import {
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import { getZ3 } from "../src/z3.js";
import { compileConstraint } from "../src/constraint-compiler.js";

describe("Constraint Compiler", () => {
  let Z3: any;

  beforeAll(async () => {
    const z3 = await getZ3();

    Z3 = z3.Context("main");
  });

  it("compiles a simple comparison", async () => {
    const solver = new Z3.Solver();

    const constraint = compileConstraint(
      Z3,
      "amount <= 10000",
      {
        amount: 5000,
      },
    );

    solver.add(
      Z3.Real.const("amount").eq(
        Z3.Real.val(5000),
      ),
    );

    solver.add(constraint);

    const result = await solver.check();

    expect(result.toString()).toBe("sat");
  });

  it("supports subtraction", async () => {
    const solver = new Z3.Solver();

    const constraint = compileConstraint(
      Z3,
      "balance - amount >= 1000",
      {
        balance: 20000,
        amount: 5000,
      },
    );

    solver.add(
      Z3.Real.const("balance").eq(
        Z3.Real.val(20000),
      ),
    );

    solver.add(
      Z3.Real.const("amount").eq(
        Z3.Real.val(5000),
      ),
    );

    solver.add(constraint);

    const result = await solver.check();

    expect(result.toString()).toBe("sat");
  });

  it("detects an invalid subtraction constraint", async () => {
    const solver = new Z3.Solver();

    const constraint = compileConstraint(
      Z3,
      "balance - amount >= 1000",
      {
        balance: 20000,
        amount: 19500,
      },
    );

    solver.add(
      Z3.Real.const("balance").eq(
        Z3.Real.val(20000),
      ),
    );

    solver.add(
      Z3.Real.const("amount").eq(
        Z3.Real.val(19500),
      ),
    );

    solver.add(constraint);

    const result = await solver.check();

    expect(result.toString()).toBe("unsat");
  });

  it("supports multiplication", async () => {
    const solver = new Z3.Solver();

    const constraint = compileConstraint(
      Z3,
      "amount * 2 <= balance",
      {
        amount: 5000,
        balance: 20000,
      },
    );

    solver.add(
      Z3.Real.const("amount").eq(
        Z3.Real.val(5000),
      ),
    );

    solver.add(
      Z3.Real.const("balance").eq(
        Z3.Real.val(20000),
      ),
    );

    solver.add(constraint);

    const result = await solver.check();

    expect(result.toString()).toBe("sat");
  });

  it("respects operator precedence", async () => {
    const solver = new Z3.Solver();

    const constraint = compileConstraint(
      Z3,
      "amount + 100 * 2 <= balance",
      {
        amount: 5000,
        balance: 5200,
      },
    );

    solver.add(
      Z3.Real.const("amount").eq(
        Z3.Real.val(5000),
      ),
    );

    solver.add(
      Z3.Real.const("balance").eq(
        Z3.Real.val(5200),
      ),
    );

    solver.add(constraint);

    const result = await solver.check();

    expect(result.toString()).toBe("sat");
  });

  it("supports parentheses", async () => {
    const solver = new Z3.Solver();

    const constraint = compileConstraint(
      Z3,
      "(amount + 100) * 2 <= balance",
      {
        amount: 5000,
        balance: 10200,
      },
    );

    solver.add(
      Z3.Real.const("amount").eq(
        Z3.Real.val(5000),
      ),
    );

    solver.add(
      Z3.Real.const("balance").eq(
        Z3.Real.val(10200),
      ),
    );

    solver.add(constraint);

    const result = await solver.check();

    expect(result.toString()).toBe("sat");
  });

  it("rejects unknown variables", async () => {
    expect(() =>
      compileConstraint(
        Z3,
        "balance - unknown_value >= 1000",
        {
          balance: 20000,
        },
      ),
    ).toThrow(
      "Unknown value in constraint: unknown_value",
    );
  });

  it("rejects invalid characters", async () => {
    expect(() =>
      compileConstraint(
        Z3,
        "amount <= process.exit()",
        {
          amount: 5000,
        },
      ),
    ).toThrow();
  });

    it("supports string equality", async () => {
    const constraint = compileConstraint(
      Z3,
      'payment_status == "paid"',
      {
        payment_status: "paid",
      },
    );

    const solver = new Z3.Solver();

    solver.add(constraint);

    const result = await solver.check();

    expect(result.toString()).toBe("sat");
  });

  it("supports boolean equality", async () => {
    const constraint = compileConstraint(
      Z3,
      "is_verified == true",
      {
        is_verified: true,
      },
    );

    const solver = new Z3.Solver();

    solver.add(constraint);

    const result = await solver.check();

    expect(result.toString()).toBe("sat");
  });

  it("supports false boolean values", async () => {
    const constraint = compileConstraint(
      Z3,
      "is_verified == false",
      {
        is_verified: false,
      },
    );

    const solver = new Z3.Solver();

    solver.add(constraint);

    const result = await solver.check();

    expect(result.toString()).toBe("sat");
  });
});
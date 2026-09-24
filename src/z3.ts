import { init } from "z3-solver";

let z3Promise: ReturnType<typeof init> | undefined;

export function getZ3() {
  if (!z3Promise) {
    z3Promise = init();
  }

  return z3Promise;
}
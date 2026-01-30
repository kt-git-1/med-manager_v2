import { expect } from "vitest";

export function assertErrorShape(payload: unknown) {
  expect(payload).toEqual(
    expect.objectContaining({
      error_code: expect.any(String),
      message: expect.any(String),
    })
  );
}

export function assertErrorCode(payload: any, code: string) {
  assertErrorShape(payload);
  expect(payload.error_code).toBe(code);
}

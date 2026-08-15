import { describe, expect, it } from "bun:test";
import { isNotFound, isValidationNotUnique } from "@/lib/pocketbase/errors";
import { ClientResponseError } from "pocketbase";

describe("PocketBase Error Helpers & Access Guards", () => {
  it("detects 404 ClientResponseError as isNotFound", () => {
    const notFoundError = new ClientResponseError({
      status: 404,
      response: { message: "The requested resource wasn't found." },
    });
    expect(isNotFound(notFoundError)).toBe(true);
  });

  it("does not report 400 or 500 as isNotFound", () => {
    const badRequest = new ClientResponseError({
      status: 400,
      response: { message: "Validation failed." },
    });
    const serverError = new ClientResponseError({
      status: 500,
      response: { message: "Internal server error." },
    });
    const genericError = new Error("Generic error");

    expect(isNotFound(badRequest)).toBe(false);
    expect(isNotFound(serverError)).toBe(false);
    expect(isNotFound(genericError)).toBe(false);
  });

  it("detects validation unique constraint violations as isValidationNotUnique", () => {
    const uniqueError = new ClientResponseError({
      status: 400,
      response: {
        data: {
          email: { code: "validation_not_unique", message: "Value must be unique." },
        },
      },
    });

    expect(isValidationNotUnique(uniqueError)).toBe(true);
    expect(isValidationNotUnique(uniqueError, "email")).toBe(true);
    expect(isValidationNotUnique(uniqueError, "name")).toBe(false);
  });
});

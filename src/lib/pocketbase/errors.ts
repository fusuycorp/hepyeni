import { ClientResponseError } from "pocketbase";

// PocketBase's 400 validation error shape:
// { status: 400, response: { code, message, data: { field: { code, message } } } }
export function isValidationNotUnique(err: unknown, field?: string): boolean {
  if (!(err instanceof ClientResponseError) || err.status !== 400) return false;

  const data = err.response?.data as
    | Record<string, { code?: string }>
    | undefined;
  if (!data) return false;

  if (field) return data[field]?.code === "validation_not_unique";
  return Object.values(data).some((e) => e?.code === "validation_not_unique");
}

export function isNotFound(err: unknown): boolean {
  return err instanceof ClientResponseError && err.status === 404;
}

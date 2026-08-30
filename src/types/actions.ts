export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string; traceId?: string; details?: Record<string, unknown> };

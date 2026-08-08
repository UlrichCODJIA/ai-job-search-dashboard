import { errorResponse } from "./http.js";
import { RootNotConfiguredError } from "./paths.js";

export function handleServerError(err: unknown): Response {
  if (err instanceof RootNotConfiguredError) {
    return errorResponse(err.message, 503);
  }
  console.error("Unhandled route error:", err);
  return errorResponse("internal server error", 500);
}

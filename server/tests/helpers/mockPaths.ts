import { afterEach, mock } from "bun:test";
const real = await import("../../src/lib/paths.js");

export const realPaths = { ...real.paths };
export const mockPaths: typeof realPaths = { ...realPaths };

mock.module("../../src/lib/paths.js", () => ({
  ...real, // preserves isConfigured/RootNotConfiguredError/looksLikeAiJobSearchCheckout/REPO_ROOT for every consumer
  paths: mockPaths,
}));

export function resetMockPaths(): void {
  Object.assign(mockPaths, realPaths);
}

afterEach(resetMockPaths);

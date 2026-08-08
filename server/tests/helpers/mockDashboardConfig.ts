import { afterEach, mock } from "bun:test";

const real = await import("../../src/lib/dashboardConfig.js");

let mockSavedConfig: { repoRoot?: string } | null = null;

mock.module("../../src/lib/dashboardConfig.js", () => ({
  ...real,
  readDashboardConfig: () => mockSavedConfig,
}));

export function setMockSavedConfig(config: { repoRoot?: string } | null): void {
  mockSavedConfig = config;
}

afterEach(() => {
  mockSavedConfig = null;
});

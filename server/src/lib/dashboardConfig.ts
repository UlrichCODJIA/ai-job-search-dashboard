import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { atomicWriteFile } from "./fs.js";

export interface DashboardConfig {
  repoRoot?: string;
}

function dashboardRoot(): string {
  return path.resolve(import.meta.dir, "..", "..", "..");
}

function configPath(): string {
  return path.join(dashboardRoot(), "server", ".dashboard-config.json");
}

export function readDashboardConfig(): DashboardConfig | null {
  const file = configPath();
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as DashboardConfig;
  } catch {
    return null;
  }
}

export async function writeDashboardConfig(config: DashboardConfig): Promise<void> {
  await atomicWriteFile(configPath(), `${JSON.stringify(config, null, 2)}\n`);
}

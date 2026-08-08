import path from "node:path";
import { writeDashboardConfig } from "../lib/dashboardConfig.js";
import { errorResponse, json } from "../lib/http.js";
import { isConfigured, looksLikeAiJobSearchCheckout, paths } from "../lib/paths.js";

export const setupRoutes = {
  "/api/setup": {
    GET: async () =>
      json({
        configured: isConfigured(),
        repoRoot: isConfigured() ? paths.repoRoot : null,
      }),
    POST: async (req: Request) => {
      const body = (await req.json().catch(() => null)) as {
        repoRoot?: string;
      } | null;
      if (typeof body?.repoRoot !== "string" || !body.repoRoot.trim()) {
        return errorResponse("body must be { repoRoot: string }");
      }
      const resolved = path.resolve(body.repoRoot.trim());
      if (!looksLikeAiJobSearchCheckout(resolved)) {
        return errorResponse(
          `"${resolved}" doesn't look like an ai-job-search checkout (expected to find CLAUDE.md and .claude/ there).`,
        );
      }
      await writeDashboardConfig({ repoRoot: resolved });
      return json({ saved: true, repoRoot: resolved });
    },
  },
};

import { afterEach, mock } from "bun:test";

export interface MockQueryArgs {
  prompt: string;
  options: Record<string, unknown>;
  abortController: AbortController;
}

export type StreamFactory = (
  args: MockQueryArgs,
) => AsyncIterable<Record<string, unknown>>;

let currentFactory: StreamFactory | null = null;
let queryCallCount = 0;
let lastCallArgs: MockQueryArgs | null = null;

mock.module("@anthropic-ai/claude-agent-sdk", () => ({
  query: (args: { prompt: string; options: Record<string, unknown> & { abortController: AbortController } }) => {
    queryCallCount++;
    const callArgs: MockQueryArgs = {
      prompt: args.prompt,
      options: args.options,
      abortController: args.options.abortController,
    };
    lastCallArgs = callArgs;
    if (!currentFactory) {
      throw new Error(
        "mockClaudeSdk: no stream factory set for this test -- call setStreamFactory(...) before starting a run",
      );
    }
    return currentFactory(callArgs);
  },
}));

export function setStreamFactory(factory: StreamFactory): void {
  currentFactory = factory;
}

export function getQueryCallCount(): number {
  return queryCallCount;
}

export function getLastCallArgs(): MockQueryArgs | null {
  return lastCallArgs;
}

afterEach(() => {
  currentFactory = null;
  queryCallCount = 0;
  lastCallArgs = null;
});

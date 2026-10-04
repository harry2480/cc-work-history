import type { SummaryGeneratorGateway } from '../../domain/gateways/summary-generator.gateway';
import { ClaudeCliSummaryAdapter } from '../../infrastructure/adapters/claude-cli-summary.adapter';
import { StubSummaryGeneratorAdapter } from '../../infrastructure/adapters/stub-summary-generator.adapter';

type Env = Record<string, string | undefined>;

/** `CC_WORK_HISTORY_STUB_SUMMARY=true` なら Stub、それ以外は Claude CLI */
export function createSummaryGenerator(env: Env = process.env): SummaryGeneratorGateway {
	if (env.CC_WORK_HISTORY_STUB_SUMMARY === 'true') return new StubSummaryGeneratorAdapter();
	return new ClaudeCliSummaryAdapter({ env });
}

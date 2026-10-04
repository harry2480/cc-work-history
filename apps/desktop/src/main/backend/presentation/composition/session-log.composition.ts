import { homedir } from 'node:os';
import { join } from 'node:path';
import type { SessionLogGateway } from '../../domain/gateways/session-log.gateway';
import { ClaudeCodeSessionLogAdapter } from '../../infrastructure/adapters/claude-code-session-log.adapter';
import { StubSessionLogAdapter } from '../../infrastructure/adapters/stub-session-log.adapter';

type Env = Record<string, string | undefined>;

/** Claude Code のログのルートディレクトリ。`CC_WORK_HISTORY_LOG_DIR` で差し替えられる */
export function resolveSessionLogRootDir(env: Env = process.env): string {
	return env.CC_WORK_HISTORY_LOG_DIR || join(homedir(), '.claude', 'projects');
}

/** `CC_WORK_HISTORY_STUB_LOGS=true` なら Stub、それ以外は本番実装 */
export function createSessionLogGateway(env: Env = process.env): SessionLogGateway {
	if (env.CC_WORK_HISTORY_STUB_LOGS === 'true') return new StubSessionLogAdapter();
	return new ClaudeCodeSessionLogAdapter(resolveSessionLogRootDir(env));
}

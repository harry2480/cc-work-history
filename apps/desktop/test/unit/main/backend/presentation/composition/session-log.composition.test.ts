import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ClaudeCodeSessionLogAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/claude-code-session-log.adapter';
import { StubSessionLogAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/stub-session-log.adapter';
import {
	createSessionLogGateway,
	resolveSessionLogRootDir,
} from '../../../../../../src/main/backend/presentation/composition/session-log.composition';

describe('session-log.composition', () => {
	it('既定のログディレクトリは ~/.claude/projects', () => {
		expect(resolveSessionLogRootDir({})).toBe(join(homedir(), '.claude', 'projects'));
	});

	it('CC_WORK_HISTORY_LOG_DIR でログディレクトリを差し替えられる', () => {
		expect(resolveSessionLogRootDir({ CC_WORK_HISTORY_LOG_DIR: '/tmp/logs' })).toBe('/tmp/logs');
	});

	it('CC_WORK_HISTORY_STUB_LOGS=true なら Stub を使う', () => {
		expect(createSessionLogGateway({ CC_WORK_HISTORY_STUB_LOGS: 'true' })).toBeInstanceOf(
			StubSessionLogAdapter,
		);
		expect(createSessionLogGateway({})).toBeInstanceOf(ClaudeCodeSessionLogAdapter);
	});
});

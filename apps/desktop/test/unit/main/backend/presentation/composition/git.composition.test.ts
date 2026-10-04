import { describe, expect, it } from 'vitest';
import { GitCliAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/git-cli.adapter';
import { StubGitAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/stub-git.adapter';
import { createGitGateway } from '../../../../../../src/main/backend/presentation/composition/git.composition';

describe('createGitGateway', () => {
	it('CC_WORK_HISTORY_STUB_GIT=true なら Stub、それ以外は git コマンドを使う', () => {
		expect(createGitGateway({ CC_WORK_HISTORY_STUB_GIT: 'true' })).toBeInstanceOf(StubGitAdapter);
		expect(createGitGateway({})).toBeInstanceOf(GitCliAdapter);
	});
});

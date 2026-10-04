import type { GitGateway } from '../../domain/gateways/git.gateway';
import { GitCliAdapter } from '../../infrastructure/adapters/git-cli.adapter';
import { StubGitAdapter } from '../../infrastructure/adapters/stub-git.adapter';

type Env = Record<string, string | undefined>;

/** `CC_WORK_HISTORY_STUB_GIT=true` なら Stub、それ以外は git コマンド */
export function createGitGateway(env: Env = process.env): GitGateway {
	if (env.CC_WORK_HISTORY_STUB_GIT === 'true') return new StubGitAdapter();
	return new GitCliAdapter({ env });
}

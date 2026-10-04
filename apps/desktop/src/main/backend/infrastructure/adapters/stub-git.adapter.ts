import type { CommitQuery, CommitStatsResult, GitGateway } from '../../domain/gateways/git.gateway';

/** テスト・開発用。git を呼ばずに固定の集計結果を返す */
export class StubGitAdapter implements GitGateway {
	readonly queries: CommitQuery[] = [];

	constructor(
		private readonly result: CommitStatsResult = {
			status: 'ok',
			value: { commitCount: 3, changedFileCount: 5 },
		},
	) {}

	async commitStats(query: CommitQuery): Promise<CommitStatsResult> {
		this.queries.push(query);
		return this.result;
	}
}

import type { Period } from './session.repository';

/** 期間の集計（活動時間は期間内に収まる部分だけを数える） */
export type PeriodStats = {
	activeMs: number;
	/** 期間に重なる活動区間を持つセッションの数 */
	sessionCount: number;
	/** 期間に重なるセッションのトークン数の合計（期間で切り分けない） */
	totalTokens: number;
	messageCount: number;
};

export type ProjectStats = {
	projectId: string;
	projectPath: string;
	activeMs: number;
	sessionCount: number;
	totalTokens: number;
};

/** ダッシュボード用の集計。件数が多くても速いよう SQL で集計する */
export interface ActivityStatsRepository {
	summarize(period: Period): PeriodStats;
	/** 区切りごとの集計（日別など）。入力と同じ順で返す */
	summarizeByBuckets(buckets: readonly Period[]): PeriodStats[];
	/** プロジェクト別の集計（活動時間の長い順） */
	summarizeByProject(period: Period): ProjectStats[];
}

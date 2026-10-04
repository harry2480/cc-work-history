import { Project } from '../../domain/models/project.model';
import type {
	ActivityStatsRepository,
	PeriodStats,
} from '../../domain/repositories/activity-stats.repository';
import type { Period } from '../../domain/repositories/session.repository';

export type DailyStats = {
	/** その日の 0:00（ローカル時刻） */
	date: Date;
	activeMs: number;
	sessionCount: number;
};

export type Dashboard = {
	summary: PeriodStats;
	daily: DailyStats[];
	projects: {
		project: { id: string; name: string; path: string };
		activeMs: number;
		sessionCount: number;
		totalTokens: number;
	}[];
};

/** ダッシュボードの統計（合計・日別・プロジェクト別）を取得する */
export class GetDashboardUseCase {
	constructor(private readonly activityStatsRepository: ActivityStatsRepository) {}

	execute(period: Period): Dashboard {
		const days = localDays(period);
		const daily = this.activityStatsRepository.summarizeByBuckets(days);

		return {
			summary: this.activityStatsRepository.summarize(period),
			daily: days.map((day, i) => ({
				date: day.from,
				activeMs: daily[i]?.activeMs ?? 0,
				sessionCount: daily[i]?.sessionCount ?? 0,
			})),
			projects: this.activityStatsRepository.summarizeByProject(period).map((stats) => ({
				project: {
					id: stats.projectId,
					name: projectName(stats.projectId, stats.projectPath),
					path: stats.projectPath,
				},
				activeMs: stats.activeMs,
				sessionCount: stats.sessionCount,
				totalTokens: stats.totalTokens,
			})),
		};
	}
}

/** 期間をローカル時刻の日ごとに区切る（夏時間でも 0:00 で区切る） */
function localDays(period: Period): Period[] {
	const days: Period[] = [];
	let from = new Date(period.from);
	while (from < period.to) {
		const next = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
		days.push({ from, to: next < period.to ? next : period.to });
		from = next;
	}
	return days;
}

function projectName(id: string, path: string): string {
	const project = Project.create({ id, path, lastActivityAt: new Date(0) });
	return project.success ? project.value.name : path;
}

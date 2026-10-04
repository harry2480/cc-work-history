import type { DashboardDto } from '../../../../shared/ipc-contract';
import type { GetDashboardUseCase } from '../../application/usecases/get-dashboard.usecase';
import { parsePeriodRequest } from './timeline.loader';

/** 期間（週・月）の統計を取得する */
export function loadDashboard(useCase: GetDashboardUseCase, request: unknown): DashboardDto {
	const dashboard = useCase.execute(parsePeriodRequest(request));
	return {
		summary: dashboard.summary,
		daily: dashboard.daily.map((day) => ({
			date: day.date.toISOString(),
			activeMs: day.activeMs,
			sessionCount: day.sessionCount,
		})),
		projects: dashboard.projects,
	};
}

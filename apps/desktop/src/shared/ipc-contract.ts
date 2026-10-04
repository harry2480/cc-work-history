/**
 * main ↔ renderer 間の IPC チャンネルと型の唯一の定義元。
 * renderer の `window.api` の型もここから導出する。
 */

export const IPC_CHANNELS = {
	ping: 'app:ping',
	/** renderer → main: 期間（週）のタイムラインを取得する */
	getTimeline: 'timeline:get',
	/** renderer → main: セッションの詳細を取得する */
	getSessionDetail: 'sessions:get-detail',
	/** renderer → main: セッションの概要とタグを手動で編集する */
	updateSessionAnnotation: 'sessions:update-annotation',
	/** renderer → main: 絞り込みの選択肢（プロジェクトとタグの一覧）を取得する */
	getFilterOptions: 'filters:get-options',
	/** renderer → main: 期間（週・月）の統計を取得する */
	getDashboard: 'dashboard:get',
	/** renderer → main: セッション一覧（絞り込み・並び替え・ページ分け）を取得する */
	listSessions: 'sessions:list',
	/** main → renderer: 取り込みでセッションが追加・更新された */
	sessionsChanged: 'sessions:changed',
} as const;

/** 疎通確認用。main が応答できることと、実行中の Electron のバージョンを返す */
export type PingResult = {
	message: string;
	electronVersion: string;
};

/** IPC で受け渡す日時はすべて ISO 8601 文字列 */
type IsoDateString = string;

export type SessionStatusDto = 'active' | 'completed';

export type ProjectSummaryDto = {
	id: string;
	name: string;
	path: string;
};

export type ActivityDto = {
	startedAt: IsoDateString;
	endedAt: IsoDateString;
	messageCount: number;
};

/** 期間の指定。`from` 以上 `to` 未満。最大 31 日 */
export type GetTimelineRequest = {
	from: IsoDateString;
	to: IsoDateString;
	filter?: SessionFilterDto;
};

/** 絞り込み条件。指定した条件はすべて満たすもの（AND）、各条件の中の候補はいずれか（OR） */
export type SessionFilterDto = {
	projectIds?: string[];
	/** いずれかのタグが付いている（大文字小文字は区別しない） */
	tags?: string[];
	/** 概要に含まれる文字列 */
	query?: string;
};

export type SessionSortKeyDto = 'startedAt' | 'project' | 'activeDuration' | 'totalTokens';

export type ListSessionsRequest = {
	filter?: SessionFilterDto;
	sort: { key: SessionSortKeyDto; direction: 'asc' | 'desc' };
	/** 1 始まり */
	page: number;
	/** 1〜200 */
	pageSize: number;
};

export type SessionListItemDto = {
	id: string;
	project: ProjectSummaryDto;
	startedAt: IsoDateString;
	endedAt: IsoDateString;
	activeDurationMs: number;
	status: SessionStatusDto;
	totalTokens: number;
	messageCount: number;
	summary: string | null;
	tags: string[];
};

export type SessionListDto = {
	items: SessionListItemDto[];
	/** 絞り込み後の件数 */
	total: number;
	page: number;
	pageSize: number;
};

/** 期間の指定。`from` 以上 `to` 未満。最大 31 日 */
export type GetDashboardRequest = {
	from: IsoDateString;
	to: IsoDateString;
};

export type DashboardDto = {
	summary: {
		/** 活動時間の合計（期間内に収まる部分だけ） */
		activeMs: number;
		sessionCount: number;
		/** 期間に重なるセッションのトークン数の合計 */
		totalTokens: number;
		messageCount: number;
	};
	/** 日ごと（ローカル時刻の 0:00 区切り） */
	daily: { date: IsoDateString; activeMs: number; sessionCount: number }[];
	/** 活動時間の長い順 */
	projects: {
		project: ProjectSummaryDto;
		activeMs: number;
		sessionCount: number;
		totalTokens: number;
	}[];
};

export type FilterOptionsDto = {
	/** 最終活動日時の新しい順 */
	projects: ProjectSummaryDto[];
	/** 名前順 */
	tags: string[];
};

export type TimelineSessionDto = {
	id: string;
	project: ProjectSummaryDto;
	startedAt: IsoDateString;
	endedAt: IsoDateString;
	status: SessionStatusDto;
	totalTokens: number;
	messageCount: number;
	summary: string | null;
	tags: string[];
	/** 期間に重なる活動区間だけ */
	activities: ActivityDto[];
};

export type TimelineDto = {
	from: IsoDateString;
	to: IsoDateString;
	sessions: TimelineSessionDto[];
};

export type GetSessionDetailRequest = {
	id: string;
};

export type SessionDetailDto = {
	id: string;
	project: ProjectSummaryDto;
	cwd: string | null;
	startedAt: IsoDateString;
	endedAt: IsoDateString;
	/** 活動区間の合計（放置時間を含まない） */
	activeDurationMs: number;
	status: SessionStatusDto;
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	messageCount: number;
	models: string[];
	summary: string | null;
	/** 概要をユーザーが手動で編集したか（自動生成で上書きしない） */
	summaryEditedManually: boolean;
	tags: SessionTagDto[];
	activities: ActivityDto[];
};

export type SessionTagDto = {
	name: string;
	/** manual: ユーザーが付けた / auto: 自動生成 */
	source: 'manual' | 'auto';
};

/** 概要（空なら null）とタグ名の一覧で置き換える */
export type UpdateSessionAnnotationRequest = {
	id: string;
	summary: string | null;
	tags: string[];
};

/** セッションの追加・更新の通知 */
export type SessionsChangedPayload = {
	sessionIds: string[];
	/** 変わったセッションが含まれる期間 */
	from: string;
	to: string;
};

/** preload が `window.api` として renderer に公開する API */
export type DesktopApi = {
	ping(): Promise<PingResult>;
	getTimeline(request: GetTimelineRequest): Promise<TimelineDto>;
	/** 見つからなければ null */
	getSessionDetail(request: GetSessionDetailRequest): Promise<SessionDetailDto | null>;
	updateSessionAnnotation(request: UpdateSessionAnnotationRequest): Promise<void>;
	getFilterOptions(): Promise<FilterOptionsDto>;
	getDashboard(request: GetDashboardRequest): Promise<DashboardDto>;
	listSessions(request: ListSessionsRequest): Promise<SessionListDto>;
	/** セッションの変更を購読する。戻り値の関数で購読を解除する */
	onSessionsChanged(listener: (payload: SessionsChangedPayload) => void): () => void;
};

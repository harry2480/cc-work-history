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
	/** renderer → main: 設定（データの場所・活動区間の閾値）を取得する */
	getSettings: 'settings:get',
	/** renderer → main: 活動区間を分ける無操作時間の閾値を変更し、活動区間を計算し直す */
	updateIdleThreshold: 'settings:update-idle-threshold',
	/** renderer → main: ターミナルを開いてセッションを再開する（claude -r） */
	resumeSession: 'sessions:resume',
	/** renderer → main: セッションの成果（期間中のコミット数・変更ファイル数）を取得する */
	getSessionResult: 'sessions:get-result',
	/** renderer → main: セッションの概要とタグを Claude CLI で生成して保存する */
	generateSessionSummary: 'sessions:generate-summary',
	/** renderer → main: セッションの会話（ユーザーとアシスタントの発言）をログから取得する */
	getSessionConversation: 'sessions:get-conversation',
	/** renderer → main: すべてのプロジェクトと、非表示にしているかを取得する */
	getProjectVisibility: 'projects:get-visibility',
	/** renderer → main: プロジェクトを非表示にする・表示に戻す */
	updateProjectVisibility: 'projects:update-visibility',
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
	/** 作業状況チェックリスト（ログ中の Claude Code の TodoWrite / TaskCreate・TaskUpdate の最終状態）。読み取り専用 */
	todos: TodoItemDto[];
};

export type TodoStatusDto = 'pending' | 'in_progress' | 'completed';

export type TodoItemDto = {
	content: string;
	status: TodoStatusDto;
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

export type SettingsDto = {
	/** Claude Code のセッションログを読むディレクトリ（変更不可・表示のみ） */
	logDirectory: string;
	/** アプリの DB ファイル */
	databasePath: string;
	/** 活動区間を分ける無操作時間の閾値（分） */
	idleThresholdMinutes: number;
	defaultIdleThresholdMinutes: number;
	minIdleThresholdMinutes: number;
	maxIdleThresholdMinutes: number;
};

export type UpdateIdleThresholdRequest = {
	minutes: number;
};

export type UpdateIdleThresholdResultDto = {
	/** 取り込めず、古い活動区間のまま残ったファイルの数（次回の起動時に計算し直す） */
	failedFiles: number;
};

export type ResumeSessionRequest = {
	id: string;
};

export type ResumeSessionResultDto =
	| { status: 'ok' }
	/** この OS では未対応 */
	| { status: 'unsupported'; reason: string }
	| { status: 'failed'; reason: string };
export type GetSessionResultRequest = {
	id: string;
};

export type SessionResultDto =
	| { status: 'commits'; commitCount: number; changedFileCount: number; computedAt: IsoDateString }
	/** 作業ディレクトリが git リポジトリでない */
	| { status: 'no_repository' }
	/** git が使えないなどで集計できなかった */
	| { status: 'unavailable'; reason: string };

export type GenerateSummaryRequest = {
	id: string;
};

export type GenerateSummaryResultDto =
	| { status: 'ok' }
	/** 同じセッションの生成が実行中 */
	| { status: 'busy' }
	/** 会話のテキストがない */
	| { status: 'empty' }
	/** Claude CLI が見つからないなど */
	| { status: 'unavailable'; reason: string }
	| { status: 'failed'; reason: string };

export type GetSessionConversationRequest = {
	id: string;
};

export type ConversationMessageDto = {
	role: 'user' | 'assistant';
	text: string;
};

export type SessionConversationDto =
	/** ツールの入出力・思考・メタ情報・サブエージェントの発言は含まない */
	| {
			status: 'ok';
			messages: ConversationMessageDto[];
			/** 古い発言を省いた、または長い発言を途中で切った */
			truncated: boolean;
	  }
	/** ログファイルが見つからない */
	| { status: 'missing' };

/** 設定画面のプロジェクト一覧（最終活動日時の新しい順） */
export type ProjectVisibilityDto = ProjectSummaryDto & {
	/** タイムライン・一覧・ダッシュボード・絞り込みの選択肢に出さない */
	hidden: boolean;
};

export type UpdateProjectVisibilityRequest = {
	projectId: string;
	hidden: boolean;
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
	getSettings(): Promise<SettingsDto>;
	/** 活動区間の再計算が終わるまで待つ */
	updateIdleThreshold(request: UpdateIdleThresholdRequest): Promise<UpdateIdleThresholdResultDto>;
	resumeSession(request: ResumeSessionRequest): Promise<ResumeSessionResultDto>;
	getSessionResult(request: GetSessionResultRequest): Promise<SessionResultDto | null>;
	/** 概要とタグを生成し、保存が終わるまで待つ */
	generateSessionSummary(request: GenerateSummaryRequest): Promise<GenerateSummaryResultDto>;
	/** 見つからなければ null */
	getSessionConversation(
		request: GetSessionConversationRequest,
	): Promise<SessionConversationDto | null>;
	getProjectVisibility(): Promise<ProjectVisibilityDto[]>;
	updateProjectVisibility(request: UpdateProjectVisibilityRequest): Promise<void>;
	/** セッションの変更を購読する。戻り値の関数で購読を解除する */
	onSessionsChanged(listener: (payload: SessionsChangedPayload) => void): () => void;
};

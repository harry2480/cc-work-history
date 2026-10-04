/** 概要・タグの生成に渡すセッションの内容 */
export type SummaryInput = {
	projectName: string;
	/** 会話の抜粋（「ユーザー: …」「アシスタント: …」の形式のテキスト） */
	conversation: string;
};

export type GeneratedSummary = {
	summary: string;
	tags: string[];
};

export type SummaryGenerationResult =
	| { status: 'ok'; value: GeneratedSummary }
	/** Claude CLI が見つからない（インストールされていない）など、生成できない環境 */
	| { status: 'unavailable'; reason: string }
	/** タイムアウト・CLI のエラー・応答の形式が不正など、今回の生成に失敗した */
	| { status: 'failed'; reason: string };

/** セッションの概要とタグを生成する */
export interface SummaryGeneratorGateway {
	generate(input: SummaryInput): Promise<SummaryGenerationResult>;
}

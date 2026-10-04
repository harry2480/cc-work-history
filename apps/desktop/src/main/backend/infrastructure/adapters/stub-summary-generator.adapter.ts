import type {
	SummaryGenerationResult,
	SummaryGeneratorGateway,
	SummaryInput,
} from '../../domain/gateways/summary-generator.gateway';

/** テスト・開発用。Claude CLI を呼ばずに固定の概要・タグを返す */
export class StubSummaryGeneratorAdapter implements SummaryGeneratorGateway {
	readonly inputs: SummaryInput[] = [];

	constructor(
		private readonly result: SummaryGenerationResult = {
			status: 'ok',
			value: { summary: '（Stub）セッションの概要', tags: ['stub'] },
		},
	) {}

	async generate(input: SummaryInput): Promise<SummaryGenerationResult> {
		this.inputs.push(input);
		return this.result;
	}
}

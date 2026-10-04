import type {
	ResumeTarget,
	TerminalLaunchResult,
	TerminalLauncherGateway,
} from '../../domain/gateways/terminal-launcher.gateway';

/** テスト・開発用。ターミナルを開かずに、頼まれた内容を記録する */
export class StubTerminalLauncherAdapter implements TerminalLauncherGateway {
	readonly targets: ResumeTarget[] = [];

	constructor(private readonly result: TerminalLaunchResult = { status: 'ok' }) {}

	async resume(target: ResumeTarget): Promise<TerminalLaunchResult> {
		this.targets.push(target);
		return this.result;
	}
}

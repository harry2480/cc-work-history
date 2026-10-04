import type { TerminalLauncherGateway } from '../../domain/gateways/terminal-launcher.gateway';
import { MacosTerminalLauncherAdapter } from '../../infrastructure/adapters/macos-terminal-launcher.adapter';
import { StubTerminalLauncherAdapter } from '../../infrastructure/adapters/stub-terminal-launcher.adapter';

type Env = Record<string, string | undefined>;

/** `CC_WORK_HISTORY_STUB_TERMINAL=true` なら Stub（ターミナルを開かない）、それ以外は Terminal.app */
export function createTerminalLauncher(env: Env = process.env): TerminalLauncherGateway {
	if (env.CC_WORK_HISTORY_STUB_TERMINAL === 'true') return new StubTerminalLauncherAdapter();
	return new MacosTerminalLauncherAdapter();
}

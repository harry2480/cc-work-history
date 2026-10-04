import { describe, expect, it } from 'vitest';
import { MacosTerminalLauncherAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/macos-terminal-launcher.adapter';
import { StubTerminalLauncherAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/stub-terminal-launcher.adapter';
import { createTerminalLauncher } from '../../../../../../src/main/backend/presentation/composition/terminal-launcher.composition';

describe('createTerminalLauncher', () => {
	it('CC_WORK_HISTORY_STUB_TERMINAL=true なら Stub、それ以外は Terminal.app を使う', () => {
		expect(createTerminalLauncher({ CC_WORK_HISTORY_STUB_TERMINAL: 'true' })).toBeInstanceOf(
			StubTerminalLauncherAdapter,
		);
		expect(createTerminalLauncher({})).toBeInstanceOf(MacosTerminalLauncherAdapter);
	});
});

// @vitest-environment jsdom
import { SettingsView } from '@/features/settings/components/settings-view';
import { paletteColorAt } from '@/lib/config/palette';
import { useApplyTheme } from '@/lib/hooks/use-apply-theme';
import { useDisplaySettingsStore } from '@/stores/display-settings-store';
import type { DesktopApi, FilterOptionsDto, SettingsDto } from '@shared/ipc-contract';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const settings: SettingsDto = {
	logDirectory: '/Users/me/.claude/projects',
	databasePath: '/Users/me/Library/Application Support/cc-work-history/cc-work-history.db',
	idleThresholdMinutes: 30,
	defaultIdleThresholdMinutes: 30,
	minIdleThresholdMinutes: 1,
	maxIdleThresholdMinutes: 240,
};

const filterOptions: FilterOptionsDto = {
	projects: [{ id: 'p1', name: 'app', path: '/repo/app' }],
	tags: ['Docs'],
};

let getSettings: ReturnType<typeof vi.fn<DesktopApi['getSettings']>>;
let updateIdleThreshold: ReturnType<typeof vi.fn<DesktopApi['updateIdleThreshold']>>;
let prefersDark = false;

function App() {
	useApplyTheme();
	return <SettingsView filterOptions={filterOptions} />;
}

beforeEach(() => {
	localStorage.clear();
	useDisplaySettingsStore.setState({
		theme: 'system',
		colorOverrides: { projects: {}, tags: {} },
	});
	document.documentElement.classList.remove('dark');
	prefersDark = false;
	window.matchMedia = vi.fn((query: string) => ({
		matches: prefersDark,
		media: query,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	})) as unknown as typeof window.matchMedia;

	getSettings = vi.fn<DesktopApi['getSettings']>(async () => settings);
	updateIdleThreshold = vi.fn<DesktopApi['updateIdleThreshold']>(async () => ({ failedFiles: 0 }));
	window.api = {
		ping: vi.fn(),
		getTimeline: vi.fn(),
		getSessionDetail: vi.fn(),
		updateSessionAnnotation: vi.fn(),
		getFilterOptions: vi.fn(),
		getDashboard: vi.fn(),
		listSessions: vi.fn(),
		getSettings,
		updateIdleThreshold,
		onSessionsChanged: () => () => {},
	};
});

afterEach(() => {
	cleanup();
});

describe('SettingsView', () => {
	it('ログディレクトリと DB ファイルのパスを表示する', async () => {
		render(<App />);

		expect(await screen.findByText(settings.logDirectory)).toBeTruthy();
		expect(screen.getByText(settings.databasePath)).toBeTruthy();
	});

	it('テーマを切り替えると html 要素に反映し、保存する', async () => {
		prefersDark = true;
		render(<App />);
		await screen.findByText(settings.logDirectory);
		// 既定は OS に従う
		expect(document.documentElement.classList.contains('dark')).toBe(true);

		fireEvent.click(screen.getByRole('button', { name: 'ライト' }));
		expect(document.documentElement.classList.contains('dark')).toBe(false);
		expect(screen.getByRole('button', { name: 'ライト' }).getAttribute('aria-pressed')).toBe(
			'true',
		);

		fireEvent.click(screen.getByRole('button', { name: 'ダーク' }));
		expect(document.documentElement.classList.contains('dark')).toBe(true);
		expect(localStorage.getItem('cc-work-history:display-settings')).toContain('"theme":"dark"');
	});

	it('プロジェクトとタグの色を選ぶと保存し、自動に戻せる', async () => {
		render(<App />);
		await screen.findByText(settings.logDirectory);

		const projectColors = screen.getByRole('group', { name: 'app の色' });
		fireEvent.click(within(projectColors).getByRole('radio', { name: '色 4' }));
		expect(useDisplaySettingsStore.getState().colorOverrides.projects).toEqual({ p1: 4 });
		expect(
			(within(projectColors).getByRole('radio', { name: '色 4' }) as HTMLInputElement).checked,
		).toBe(true);

		const tagColors = screen.getByRole('group', { name: '#Docs の色' });
		fireEvent.click(within(tagColors).getByRole('radio', { name: '色 2' }));
		expect(useDisplaySettingsStore.getState().colorOverrides.tags).toEqual({ docs: 2 });
		const swatch = screen.getByText('#Docs').previousElementSibling as HTMLElement;
		expect(swatch.style.backgroundColor).toBe(paletteColorAt(2));

		fireEvent.click(within(projectColors).getByRole('radio', { name: '自動' }));
		expect(useDisplaySettingsStore.getState().colorOverrides.projects).toEqual({});
		expect(localStorage.getItem('cc-work-history:display-settings')).toContain('"docs":2');
	});

	it('閾値を変更すると保存して再計算し、新しい値を表示する', async () => {
		getSettings.mockResolvedValueOnce(settings).mockResolvedValue({
			...settings,
			idleThresholdMinutes: 45,
		});
		render(<App />);
		const input = await screen.findByLabelText('無操作時間の閾値（分）');
		const submit = screen.getByRole('button', { name: '保存して再計算' });
		expect((submit as HTMLButtonElement).disabled).toBe(true);

		fireEvent.change(input, { target: { value: '45' } });
		fireEvent.click(submit);

		expect(await screen.findByText('保存し、活動区間を計算し直しました。')).toBeTruthy();
		expect(updateIdleThreshold).toHaveBeenCalledWith({ minutes: 45 });
		expect(
			((await screen.findByLabelText('無操作時間の閾値（分）')) as HTMLInputElement).value,
		).toBe('45');
	});

	it('範囲外の閾値は保存できない', async () => {
		render(<App />);
		const input = await screen.findByLabelText('無操作時間の閾値（分）');

		fireEvent.change(input, { target: { value: '0' } });

		expect(screen.getByText('1〜240 の整数で入力してください。')).toBeTruthy();
		expect(
			(screen.getByRole('button', { name: '保存して再計算' }) as HTMLButtonElement).disabled,
		).toBe(true);
	});

	it('読み込めなかったログがあれば件数を表示する', async () => {
		updateIdleThreshold.mockResolvedValue({ failedFiles: 3 });
		render(<App />);
		const input = await screen.findByLabelText('無操作時間の閾値（分）');

		fireEvent.change(input, { target: { value: '10' } });
		fireEvent.click(screen.getByRole('button', { name: '保存して再計算' }));

		expect(await screen.findByText(/3 件のログは読み込めず/)).toBeTruthy();
	});

	it('保存に失敗したら、Electron の前置きを除いたエラーを表示する', async () => {
		updateIdleThreshold.mockRejectedValue(
			new Error(
				"Error invoking remote method 'settings:update-idle-threshold': Error: 再計算に失敗しました",
			),
		);
		render(<App />);
		const input = await screen.findByLabelText('無操作時間の閾値（分）');

		fireEvent.change(input, { target: { value: '10' } });
		fireEvent.click(screen.getByRole('button', { name: '保存して再計算' }));

		expect((await screen.findByText('再計算に失敗しました')).textContent).toBe(
			'再計算に失敗しました',
		);
	});
});

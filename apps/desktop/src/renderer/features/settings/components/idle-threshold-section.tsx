import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ipcErrorMessage } from '@/lib/utils/ipc-error';
import type { SettingsDto, UpdateIdleThresholdResultDto } from '@shared/ipc-contract';
import { type FormEvent, useState } from 'react';
import { parseIdleThresholdInput } from '../utils/idle-threshold';
import { SettingsSection } from './settings-section';

type Props = {
	settings: SettingsDto;
	onSave: (minutes: number) => Promise<UpdateIdleThresholdResultDto>;
};

type Status =
	| { kind: 'idle' }
	| { kind: 'saving' }
	| { kind: 'saved'; failedFiles: number }
	| { kind: 'error'; message: string };

/** 活動区間を分ける無操作時間の閾値。変更するとすべてのセッションの活動区間を計算し直す */
export function IdleThresholdSection({ settings, onSave }: Props) {
	const [input, setInput] = useState(String(settings.idleThresholdMinutes));
	const [status, setStatus] = useState<Status>({ kind: 'idle' });
	const { minIdleThresholdMinutes: min, maxIdleThresholdMinutes: max } = settings;
	const minutes = parseIdleThresholdInput(input, min, max);
	const unchanged = minutes === settings.idleThresholdMinutes;

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (minutes === null || unchanged) return;
		setStatus({ kind: 'saving' });
		try {
			const { failedFiles } = await onSave(minutes);
			setStatus({ kind: 'saved', failedFiles });
		} catch (e) {
			setStatus({ kind: 'error', message: ipcErrorMessage(e) });
		}
	};

	return (
		<SettingsSection
			title="活動区間"
			description={`メッセージの間がこの時間より空いたら、別の活動区間に分けます（既定 ${settings.defaultIdleThresholdMinutes} 分）。進行中かどうかの判定にも使います。`}
		>
			<form onSubmit={submit} className="flex flex-wrap items-end gap-2">
				<div className="flex flex-col gap-1">
					<Label htmlFor="idle-threshold">無操作時間の閾値（分）</Label>
					<Input
						id="idle-threshold"
						type="number"
						inputMode="numeric"
						min={min}
						max={max}
						step={1}
						className="w-28"
						value={input}
						aria-invalid={minutes === null}
						disabled={status.kind === 'saving'}
						onChange={(e) => {
							setInput(e.target.value);
							setStatus({ kind: 'idle' });
						}}
					/>
				</div>
				<Button
					type="submit"
					size="sm"
					disabled={minutes === null || unchanged || status.kind === 'saving'}
				>
					{status.kind === 'saving' ? '再計算中…' : '保存して再計算'}
				</Button>
			</form>
			{minutes === null && (
				<p className="text-xs text-destructive">
					{min}〜{max} の整数で入力してください。
				</p>
			)}
			<output aria-live="polite" className="text-xs">
				{status.kind === 'saved' && status.failedFiles === 0 && (
					<span className="text-muted-foreground">保存し、活動区間を計算し直しました。</span>
				)}
				{status.kind === 'saved' && status.failedFiles > 0 && (
					<span className="text-destructive">
						保存しましたが、{status.failedFiles}{' '}
						件のログは読み込めず、計算し直せませんでした。次回の起動時にもう一度試します。
					</span>
				)}
				{status.kind === 'error' && <span className="text-destructive">{status.message}</span>}
			</output>
		</SettingsSection>
	);
}

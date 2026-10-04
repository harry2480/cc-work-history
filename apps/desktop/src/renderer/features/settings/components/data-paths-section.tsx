import type { SettingsDto } from '@shared/ipc-contract';
import { SettingsSection } from './settings-section';

/** ログと DB の場所（表示のみ） */
export function DataPathsSection({ settings }: { settings: SettingsDto }) {
	return (
		<SettingsSection title="データの場所" description="ログは読み取るだけで、変更しません。">
			<dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
				<dt className="text-muted-foreground">セッションログ</dt>
				<dd className="break-all font-mono text-xs leading-5">{settings.logDirectory}</dd>
				<dt className="text-muted-foreground">データベース</dt>
				<dd className="break-all font-mono text-xs leading-5">{settings.databasePath}</dd>
			</dl>
		</SettingsSection>
	);
}

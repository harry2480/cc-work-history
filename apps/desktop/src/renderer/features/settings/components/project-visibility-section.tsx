import { Switch } from '@/components/ui/switch';
import { ipcErrorMessage } from '@/lib/utils/ipc-error';
import { useState } from 'react';
import { useProjectVisibility } from '../api/use-project-visibility';
import { SettingsSection } from './settings-section';

/** プロジェクトの表示・非表示。非表示にしたプロジェクトはタイムライン・一覧・ダッシュボードに出さない */
export function ProjectVisibilitySection() {
	const { data, error, setHidden } = useProjectVisibility();
	const [updateError, setUpdateError] = useState<string | null>(null);
	const [pendingId, setPendingId] = useState<string | null>(null);

	const toggle = async (projectId: string, hidden: boolean) => {
		setPendingId(projectId);
		setUpdateError(null);
		try {
			await setHidden(projectId, hidden);
		} catch (e) {
			setUpdateError(ipcErrorMessage(e));
		} finally {
			setPendingId(null);
		}
	};

	return (
		<SettingsSection
			title="表示するプロジェクト"
			description="オフにしたプロジェクトは、タイムライン・セッション一覧・ダッシュボード・絞り込みに出しません。ログの取り込みは続けるので、オンに戻せばすぐに表示されます。"
		>
			{error && (
				<p role="alert" className="text-sm text-destructive">
					プロジェクトを読み込めませんでした: {error}
				</p>
			)}
			{updateError && (
				<p role="alert" className="text-sm text-destructive">
					変更できませんでした: {updateError}
				</p>
			)}
			{data &&
				(data.length === 0 ? (
					<p className="text-sm text-muted-foreground">プロジェクトはまだありません。</p>
				) : (
					<ul className="flex flex-col gap-2">
						{data.map((project) => (
							<li key={project.id} className="flex items-center gap-3">
								<Switch
									checked={!project.hidden}
									disabled={pendingId !== null}
									aria-label={`${project.name} を表示する`}
									onCheckedChange={(checked) => void toggle(project.id, !checked)}
								/>
								<span
									className={
										project.hidden ? 'truncate text-sm text-muted-foreground' : 'truncate text-sm'
									}
									title={project.path}
								>
									{project.name}
								</span>
							</li>
						))}
					</ul>
				))}
		</SettingsSection>
	);
}

import { PALETTE_SIZE, paletteColor, paletteColorAt } from '@/lib/config/palette';
import { cn } from '@/lib/utils/cn';
import { useDisplaySettingsStore } from '@/stores/display-settings-store';
import type { FilterOptionsDto } from '@shared/ipc-contract';
import { useId } from 'react';
import { SettingsSection } from './settings-section';

const PALETTE = Array.from({ length: PALETTE_SIZE }, (_, i) => i + 1);

/** プロジェクトとタグの色。選ばなければ名前から自動で決まる */
export function ColorSection({ projects, tags }: FilterOptionsDto) {
	const overrides = useDisplaySettingsStore((s) => s.colorOverrides);
	const setProjectColor = useDisplaySettingsStore((s) => s.setProjectColor);
	const setTagColor = useDisplaySettingsStore((s) => s.setTagColor);

	return (
		<SettingsSection
			title="色"
			description="タイムラインの色分けに使います。「自動」は名前から毎回同じ色を選びます。"
		>
			<ColorList
				title="プロジェクト"
				emptyText="プロジェクトはまだありません。"
				items={projects.map((p) => ({ key: p.id, label: p.name, title: p.path }))}
				overrides={overrides.projects}
				onChange={setProjectColor}
			/>
			<ColorList
				title="タグ"
				emptyText="タグはまだありません。"
				items={tags.map((tag) => ({ key: tag.toLowerCase(), label: `#${tag}`, title: tag }))}
				overrides={overrides.tags}
				onChange={setTagColor}
			/>
		</SettingsSection>
	);
}

type ColorListProps = {
	title: string;
	emptyText: string;
	items: { key: string; label: string; title: string }[];
	overrides: Record<string, number>;
	onChange: (key: string, index: number | null) => void;
};

function ColorList({ title, emptyText, items, overrides, onChange }: ColorListProps) {
	return (
		<div>
			<h3 className="mb-2 text-xs font-bold text-muted-foreground">{title}</h3>
			{items.length === 0 ? (
				<p className="text-sm text-muted-foreground">{emptyText}</p>
			) : (
				<ul className="flex flex-col gap-1">
					{items.map((item) => (
						<li key={item.key} className="flex items-center gap-3">
							<span
								aria-hidden
								className="size-3 shrink-0 rounded-full"
								style={{ backgroundColor: paletteColor(item.key, overrides[item.key]) }}
							/>
							<span className="w-40 truncate text-sm" title={item.title}>
								{item.label}
							</span>
							<ColorPicker
								label={`${item.label} の色`}
								value={overrides[item.key] ?? null}
								onChange={(index) => onChange(item.key, index)}
							/>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

type ColorPickerProps = {
	label: string;
	/** null は自動 */
	value: number | null;
	onChange: (index: number | null) => void;
};

function ColorPicker({ label, value, onChange }: ColorPickerProps) {
	const name = useId();

	return (
		<fieldset className="flex items-center gap-1">
			<legend className="sr-only">{label}</legend>
			<label
				className={cn(
					'cursor-pointer rounded-md px-2 py-0.5 text-xs has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
					value === null ? 'bg-secondary font-bold' : 'text-muted-foreground hover:bg-accent',
				)}
			>
				<input
					type="radio"
					name={name}
					className="sr-only"
					checked={value === null}
					onChange={() => onChange(null)}
				/>
				自動
			</label>
			{PALETTE.map((index) => (
				<label
					key={index}
					className={cn(
						'size-5 cursor-pointer rounded-full border-2 border-transparent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
						value === index && 'border-foreground',
					)}
					style={{ backgroundColor: paletteColorAt(index) }}
				>
					<input
						type="radio"
						name={name}
						className="sr-only"
						aria-label={`色 ${index}`}
						checked={value === index}
						onChange={() => onChange(index)}
					/>
				</label>
			))}
		</fieldset>
	);
}

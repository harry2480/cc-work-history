import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useFilterStore } from '@/stores/filter-store';
import { ChevronDown, Search, X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { useFilterOptions } from '../api/use-filter-options';

const SEARCH_DEBOUNCE_MS = 300;

/** プロジェクト・タグ・概要のキーワードでタイムラインを絞り込む */
export function FilterBar() {
	const options = useFilterOptions();
	const { projectIds, tags, query, toggleProject, toggleTag, setQuery, clear } = useFilterStore();
	const [input, setInput] = useState(query);

	// 入力が止まってから検索する
	useEffect(() => {
		const timer = setTimeout(() => setQuery(input), SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [input, setQuery]);

	// クリアなど外から条件が変わったら入力欄にも反映する
	useEffect(() => {
		setInput(query);
	}, [query]);

	const isFiltered = projectIds.length > 0 || tags.length > 0 || query.trim() !== '';

	return (
		<section aria-label="絞り込み" className="flex flex-wrap items-center gap-2">
			<div className="relative">
				<Search className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					aria-label="概要を検索"
					placeholder="概要を検索"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					maxLength={200}
					className="h-8 w-56 pl-8"
				/>
			</div>
			<MultiSelect label="プロジェクト" selectedCount={projectIds.length}>
				{options.projects.length === 0 && <Empty />}
				{options.projects.map((project) => (
					<Option
						key={project.id}
						label={project.name}
						title={project.path}
						checked={projectIds.includes(project.id)}
						onToggle={() => toggleProject(project.id)}
					/>
				))}
			</MultiSelect>
			<MultiSelect label="タグ" selectedCount={tags.length}>
				{options.tags.length === 0 && <Empty />}
				{options.tags.map((tag) => (
					<Option
						key={tag}
						label={`#${tag}`}
						checked={tags.includes(tag)}
						onToggle={() => toggleTag(tag)}
					/>
				))}
			</MultiSelect>
			{isFiltered && (
				<Button
					variant="ghost"
					size="sm"
					onClick={() => {
						// 入力途中の検索が、クリアの後に反映されないようにする
						setInput('');
						clear();
					}}
				>
					<X />
					条件をクリア
				</Button>
			)}
		</section>
	);
}

function MultiSelect({
	label,
	selectedCount,
	children,
}: {
	label: string;
	selectedCount: number;
	children: ReactNode;
}) {
	return (
		<details className="group relative">
			<summary className="flex h-8 cursor-pointer list-none items-center gap-1 rounded-button border bg-background px-3 text-sm hover:bg-accent">
				{label}
				{selectedCount > 0 && <span className="text-primary">（{selectedCount}）</span>}
				<ChevronDown className="size-4 transition-transform group-open:rotate-180" />
			</summary>
			<fieldset className="absolute z-30 mt-1 max-h-72 w-64 overflow-auto rounded-md border bg-popover p-2 shadow-modal">
				<legend className="sr-only">{label}</legend>
				{children}
			</fieldset>
		</details>
	);
}

function Option({
	label,
	title,
	checked,
	onToggle,
}: {
	label: string;
	title?: string;
	checked: boolean;
	onToggle: () => void;
}) {
	const id = useId();
	return (
		<label
			htmlFor={id}
			title={title}
			className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
		>
			<Checkbox id={id} checked={checked} onCheckedChange={onToggle} />
			<span className="truncate">{label}</span>
		</label>
	);
}

function Empty() {
	return <p className="px-2 py-1 text-sm text-muted-foreground">選択肢がありません</p>;
}

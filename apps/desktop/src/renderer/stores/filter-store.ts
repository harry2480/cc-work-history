import type { SessionFilterDto } from '@shared/ipc-contract';
import { create } from 'zustand';

type FilterState = {
	projectIds: string[];
	tags: string[];
	query: string;
	toggleProject: (projectId: string) => void;
	toggleTag: (tag: string) => void;
	/** 選択から外す（非表示にしたプロジェクトなど、選択肢から消えたもの） */
	removeProject: (projectId: string) => void;
	setQuery: (query: string) => void;
	clear: () => void;
};

export const useFilterStore = create<FilterState>((set) => ({
	projectIds: [],
	tags: [],
	query: '',
	toggleProject: (projectId) =>
		set((state) => ({ projectIds: toggle(state.projectIds, projectId) })),
	toggleTag: (tag) => set((state) => ({ tags: toggle(state.tags, tag) })),
	removeProject: (projectId) =>
		set((state) => ({ projectIds: state.projectIds.filter((id) => id !== projectId) })),
	setQuery: (query) => set({ query }),
	clear: () => set({ projectIds: [], tags: [], query: '' }),
}));

/** 絞り込み条件を IPC のリクエストにする（未指定の条件は送らない） */
export function toFilterDto(
	state: Pick<FilterState, 'projectIds' | 'tags' | 'query'>,
): SessionFilterDto {
	const filter: SessionFilterDto = {};
	if (state.projectIds.length > 0) filter.projectIds = state.projectIds;
	if (state.tags.length > 0) filter.tags = state.tags;
	if (state.query.trim()) filter.query = state.query.trim();
	return filter;
}

function toggle(values: string[], value: string): string[] {
	return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

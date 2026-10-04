import { describe, expect, it } from 'vitest';
import { Project } from '../../../../../../src/main/backend/domain/models/project.model';

const lastActivityAt = new Date('2026-10-01T09:00:00Z');

function create(path: string) {
	const result = Project.create({ id: '-Users-me-repo-app', path, lastActivityAt });
	if (!result.success) throw new Error(result.error);
	return result.value;
}

describe('Project', () => {
	it('作業ディレクトリの末尾のフォルダ名を表示名にする', () => {
		expect(create('/Users/me/repo/app').name).toBe('app');
		expect(create('/Users/me/repo/app/').name).toBe('app');
		expect(create('C:\\Users\\me\\app').name).toBe('app');
	});

	it('ID・パスが空ならエラーにする', () => {
		expect(Project.create({ id: ' ', path: '/a', lastActivityAt })).toEqual({
			success: false,
			error: 'EMPTY_ID',
		});
		expect(Project.create({ id: 'p', path: '', lastActivityAt })).toEqual({
			success: false,
			error: 'EMPTY_PATH',
		});
	});

	it('touch はより新しい日時のときだけ最終活動日時を更新する', () => {
		const project = create('/a');
		const later = new Date(lastActivityAt.getTime() + 1);

		expect(project.touch(later).lastActivityAt).toEqual(later);
		expect(project.touch(new Date(0))).toBe(project);
	});
});

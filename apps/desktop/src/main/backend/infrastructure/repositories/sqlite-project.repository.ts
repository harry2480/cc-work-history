import type Database from 'better-sqlite3';
import { Project } from '../../domain/models/project.model';
import type { ProjectRepository } from '../../domain/repositories/project.repository';

export type ProjectRow = {
	id: string;
	path: string;
	last_activity_at: number;
};

export class SqliteProjectRepository implements ProjectRepository {
	constructor(private readonly db: Database.Database) {}

	save(project: Project): void {
		this.db
			.prepare<[string, string, number]>(
				`INSERT INTO projects (id, path, last_activity_at) VALUES (?, ?, ?)
				ON CONFLICT (id) DO UPDATE SET path = excluded.path, last_activity_at = excluded.last_activity_at`,
			)
			.run(project.id, project.path, project.lastActivityAt.getTime());
	}

	findById(id: string): Project | null {
		const row = this.db
			.prepare<[string], ProjectRow>('SELECT * FROM projects WHERE id = ?')
			.get(id);
		return row ? SqliteProjectRepository.toModel(row) : null;
	}

	findAll(): Project[] {
		return this.db
			.prepare<[], ProjectRow>('SELECT * FROM projects ORDER BY last_activity_at DESC, id')
			.all()
			.map((row) => SqliteProjectRepository.toModel(row));
	}

	findHiddenIds(): string[] {
		return this.db
			.prepare<[], { id: string }>('SELECT id FROM projects WHERE hidden = 1 ORDER BY id')
			.all()
			.map((row) => row.id);
	}

	setHidden(projectId: string, hidden: boolean): boolean {
		const result = this.db
			.prepare<[number, string]>('UPDATE projects SET hidden = ? WHERE id = ?')
			.run(hidden ? 1 : 0, projectId);
		return result.changes > 0;
	}

	static toModel(row: ProjectRow): Project {
		const result = Project.create({
			id: row.id,
			path: row.path,
			lastActivityAt: new Date(row.last_activity_at),
		});
		if (!result.success) throw new Error(`projects の行が不正です（${row.id}）: ${result.error}`);
		return result.value;
	}
}

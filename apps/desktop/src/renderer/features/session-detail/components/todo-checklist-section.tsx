import { cn } from '@/lib/utils/cn';
import type { TodoItemDto, TodoStatusDto } from '@shared/ipc-contract';
import { CircleCheck, CircleDot, Circle as CircleIcon } from 'lucide-react';

const STATUS: Record<TodoStatusDto, { label: string; Icon: typeof CircleIcon; className: string }> =
	{
		completed: { label: '完了', Icon: CircleCheck, className: 'text-muted-foreground' },
		in_progress: { label: '進行中', Icon: CircleDot, className: 'font-medium text-primary' },
		pending: { label: '未着手', Icon: CircleIcon, className: '' },
	};

/** Claude Code の作業リスト（TodoWrite / TaskCreate・TaskUpdate）の最終状態を、読み取り専用のチェックリストとして表示する */
export function TodoChecklistSection({ todos }: { todos: readonly TodoItemDto[] }) {
	const completed = todos.filter((t) => t.status === 'completed').length;

	return (
		<section aria-labelledby="todo-checklist-heading">
			<h3 id="todo-checklist-heading" className="mb-2 text-sm font-bold text-muted-foreground">
				作業状況
				{todos.length > 0 && (
					<span className="ml-1 font-normal">
						（{completed}/{todos.length} 完了）
					</span>
				)}
			</h3>
			{todos.length > 0 ? (
				<ul aria-label="作業状況チェックリスト" className="flex flex-col gap-1 text-sm">
					{todos.map((todo, index) => {
						const { label, Icon, className } = STATUS[todo.status];
						return (
							// 同じ内容の項目がありうるため、順番をキーに含める（読み取り専用で並び替えない）
							<li key={`${index}-${todo.content}`} className={cn('flex gap-2', className)}>
								<Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
								<span className="sr-only">{label}: </span>
								<span
									className={cn(
										'min-w-0 break-words',
										todo.status === 'completed' && 'line-through',
									)}
								>
									{todo.content}
								</span>
							</li>
						);
					})}
				</ul>
			) : (
				<p className="text-sm text-muted-foreground">
					このセッションにはタスクの記録がありません。
				</p>
			)}
		</section>
	);
}

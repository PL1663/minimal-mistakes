import React, { FormEvent, KeyboardEvent, useCallback, useMemo, useState } from 'react';

/**
 * Section-ready single-file template:
 * - TodoEngine (pure)
 * - useTodoManager (hook)
 * - UI components (Tailwind)
 */

// ---------- Types ----------

export type TodoId = string;

export interface Todo {
  id: TodoId;
  text: string;
  isCompleted: boolean;
  createdAt: string;
  completedAt?: string;
}

/**
 * Future-compatible extension bag.
 * Add optional fields here first so existing API remains stable.
 */
export interface TodoExtensions {
  tags?: string[];
  dueDate?: string;
  reminderAt?: string;
  sync?: {
    status: 'local' | 'pending' | 'synced' | 'error';
    remoteId?: string;
    lastSyncedAt?: string;
  };
}

export type TodoEntity = Todo & TodoExtensions;

export interface TodoDraft {
  text: string;
}

export interface TodoFilterState {
  hideCompleted: boolean;
}

// ---------- TodoEngine (pure functions) ----------

export interface TodoEngineApi {
  createTodo(draft: TodoDraft, now: string, idFactory: () => TodoId): TodoEntity;
  add(todos: TodoEntity[], draft: TodoDraft, now: string, idFactory: () => TodoId): TodoEntity[];
  remove(todos: TodoEntity[], id: TodoId): TodoEntity[];
  edit(todos: TodoEntity[], id: TodoId, text: string): TodoEntity[];
  toggleComplete(todos: TodoEntity[], id: TodoId, now: string): TodoEntity[];
  applyFilter(todos: TodoEntity[], filter: TodoFilterState): TodoEntity[];
  validateText(text: string): { ok: true; value: string } | { ok: false; reason: 'blank' };
}

export const TodoEngine: TodoEngineApi = {
  createTodo(draft, now, idFactory) {
    const validation = TodoEngine.validateText(draft.text);
    if (!validation.ok) {
      throw new Error('Todo text cannot be blank.');
    }

    return {
      id: idFactory(),
      text: validation.value,
      isCompleted: false,
      createdAt: now,
      completedAt: undefined,
    };
  },

  add(todos, draft, now, idFactory) {
    const next = TodoEngine.createTodo(draft, now, idFactory);
    return [next, ...todos];
  },

  remove(todos, id) {
    return todos.filter((todo) => todo.id !== id);
  },

  edit(todos, id, text) {
    const validation = TodoEngine.validateText(text);
    if (!validation.ok) {
      return todos;
    }

    return todos.map((todo) => {
      if (todo.id !== id) return todo;
      return {
        ...todo,
        text: validation.value,
        // createdAt intentionally preserved to satisfy invariant
        createdAt: todo.createdAt,
      };
    });
  },

  toggleComplete(todos, id, now) {
    return todos.map((todo) => {
      if (todo.id !== id) return todo;
      const nextCompleted = !todo.isCompleted;
      return {
        ...todo,
        isCompleted: nextCompleted,
        completedAt: nextCompleted ? now : undefined,
      };
    });
  },

  applyFilter(todos, filter) {
    if (!filter.hideCompleted) return todos;
    return todos.filter((todo) => !todo.isCompleted);
  },

  validateText(text) {
    const normalized = text.trim();
    if (normalized.length === 0) {
      return { ok: false, reason: 'blank' };
    }
    return { ok: true, value: normalized };
  },
};

// ---------- Hook: useTodoManager ----------

interface TodoManager {
  state: {
    todos: TodoEntity[];
    hideCompleted: boolean;
    inputText: string;
  };
  selectors: {
    filteredTodos: TodoEntity[];
    completedCount: number;
    activeCount: number;
  };
  actions: {
    setInputText: (value: string) => void;
    addTodo: () => void;
    deleteTodo: (id: TodoId) => void;
    editTodo: (id: TodoId, text: string) => void;
    toggleTodo: (id: TodoId) => void;
    setHideCompleted: (value: boolean) => void;
  };
}

const defaultIdFactory = (): TodoId => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const nowIso = (): string => new Date().toISOString();

export function useTodoManager(initialTodos: TodoEntity[] = []): TodoManager {
  const [todos, setTodos] = useState<TodoEntity[]>(initialTodos);
  const [hideCompleted, setHideCompleted] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');

  const addTodo = useCallback(() => {
    setTodos((prev) => {
      const validation = TodoEngine.validateText(inputText);
      if (!validation.ok) return prev;
      return TodoEngine.add(prev, { text: validation.value }, nowIso(), defaultIdFactory);
    });
    setInputText('');
  }, [inputText]);

  const deleteTodo = useCallback((id: TodoId) => {
    setTodos((prev) => TodoEngine.remove(prev, id));
  }, []);

  const editTodo = useCallback((id: TodoId, text: string) => {
    setTodos((prev) => TodoEngine.edit(prev, id, text));
  }, []);

  const toggleTodo = useCallback((id: TodoId) => {
    setTodos((prev) => TodoEngine.toggleComplete(prev, id, nowIso()));
  }, []);

  const filteredTodos = useMemo(
    () => TodoEngine.applyFilter(todos, { hideCompleted }),
    [todos, hideCompleted],
  );

  const completedCount = useMemo(
    () => todos.filter((todo) => todo.isCompleted).length,
    [todos],
  );

  const activeCount = useMemo(
    () => todos.length - completedCount,
    [todos.length, completedCount],
  );

  /**
   * Side-effect insertion points:
   * 1) LocalStorage persistence: useEffect(() => save(todos), [todos])
   * 2) Initial hydration: useEffect(() => setTodos(load()), [])
   * 3) Cloud sync queue: useEffect(() => syncDiff(todos), [todos])
   */

  return {
    state: {
      todos,
      hideCompleted,
      inputText,
    },
    selectors: {
      filteredTodos,
      completedCount,
      activeCount,
    },
    actions: {
      setInputText,
      addTodo,
      deleteTodo,
      editTodo,
      toggleTodo,
      setHideCompleted,
    },
  };
}

// ---------- UI Components ----------

type ItemMode = 'viewing' | 'editing';

interface TodoItemProps {
  todo: TodoEntity;
  onToggle: (id: TodoId) => void;
  onDelete: (id: TodoId) => void;
  onEdit: (id: TodoId, text: string) => void;
}

function formatTime(iso?: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString();
}

function TodoItem({ todo, onToggle, onDelete, onEdit }: TodoItemProps) {
  const [mode, setMode] = useState<ItemMode>('viewing');
  const [draft, setDraft] = useState<string>(todo.text);

  const startEditing = () => {
    setDraft(todo.text);
    setMode('editing');
  };

  const cancelEditing = () => {
    setDraft(todo.text);
    setMode('viewing');
  };

  const submitEdit = () => {
    const normalized = draft.trim();
    if (normalized.length === 0) {
      return;
    }
    onEdit(todo.id, normalized);
    setMode('viewing');
  };

  const onEditKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      submitEdit();
    }
    if (event.key === 'Escape') {
      cancelEditing();
    }
  };

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <input
          aria-label={`toggle-${todo.id}`}
          type="checkbox"
          checked={todo.isCompleted}
          onChange={() => onToggle(todo.id)}
          className="mt-1 h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600"
        />

        <div className="min-w-0 flex-1">
          {mode === 'viewing' ? (
            <>
              <p
                className={`break-words text-sm leading-6 text-slate-800 ${
                  todo.isCompleted ? 'line-through text-slate-400' : ''
                }`}
                title={todo.text}
              >
                {todo.text}
              </p>
              <div className="mt-1 text-xs text-slate-500">
                <span>Created: {formatTime(todo.createdAt)}</span>
                {' · '}
                <span>Completed: {formatTime(todo.completedAt)}</span>
              </div>
            </>
          ) : (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onEditKeyDown}
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
            />
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {mode === 'viewing' ? (
            <button
              type="button"
              onClick={startEditing}
              className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
            >
              Edit
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={submitEdit}
                className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
              >
                Save
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onDelete(todo.id)}
            className="rounded bg-rose-50 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100"
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}

export default function TodoList() {
  const { state, selectors, actions } = useTodoManager();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    actions.addTodo();
  };

  const isInputBlank = state.inputText.trim().length === 0;

  return (
    <section className="mx-auto w-full max-w-2xl rounded-xl bg-slate-50 p-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Todo List</h1>
        <p className="text-sm text-slate-600">Reusable core template: Engine + Hook + UI</p>
      </header>

      <form onSubmit={onSubmit} className="mb-4 flex gap-2">
        <input
          type="text"
          value={state.inputText}
          onChange={(e) => actions.setInputText(e.target.value)}
          placeholder="Add a todo..."
          className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={isInputBlank}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white enabled:hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Add
        </button>
      </form>

      <div className="mb-4 flex items-center justify-between text-sm">
        <label className="inline-flex cursor-pointer items-center gap-2 text-slate-700">
          <input
            type="checkbox"
            checked={state.hideCompleted}
            onChange={(e) => actions.setHideCompleted(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600"
          />
          Hide completed
        </label>
        <span className="text-slate-500">
          Active: {selectors.activeCount} · Completed: {selectors.completedCount}
        </span>
      </div>

      {selectors.filteredTodos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          {state.todos.length === 0
            ? 'No todos yet. Add your first task.'
            : 'No visible todos. Disable "Hide completed" to view all.'}
        </div>
      ) : (
        <ul className="space-y-2">
          {selectors.filteredTodos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={actions.toggleTodo}
              onDelete={actions.deleteTodo}
              onEdit={actions.editTodo}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

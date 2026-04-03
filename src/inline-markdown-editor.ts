import { App, Scope } from 'obsidian';
import { EditorView, placeholder as cmPlaceholder } from '@codemirror/view';
import { StateEffect } from '@codemirror/state';

/**
 * Extract Obsidian's internal MarkdownEditMode base class
 * from embedRegistry, following Components plugin's OB pattern.
 */
function getMarkdownEditModeBase(app: App): any {
	const embed = (app as any).embedRegistry.embedByExtension.md(
		{ app, containerEl: document.createElement('div') }, null, ''
	);
	embed.editable = true;
	embed.showEditor();
	const base = Object.getPrototypeOf(Object.getPrototypeOf(embed.editMode));
	embed.unload();
	return base.constructor;
}

let MarkdownEditModeBase: any = null;

export interface InlineMarkdownEditorOptions {
	value: string;
	placeholder?: string;
	onChange?: (value: string) => void;
	onBlur?: () => void;
}

/**
 * Inline Markdown editor with Obsidian live-preview.
 * Provides a rich text editing experience for a string value.
 */
export class InlineMarkdownEditor {
	private editMode: any;
	private scope: Scope;
	private _destroyed = false;
	private _observer: MutationObserver | null = null;
	public containerEl: HTMLElement;

	constructor(
		private app: App,
		container: HTMLElement,
		private options: InlineMarkdownEditorOptions
	) {
		this.containerEl = container;

		if (!MarkdownEditModeBase) {
			MarkdownEditModeBase = getMarkdownEditModeBase(app);
		}

		const owner: any = {
			app,
			file: null,
			editMode: null,
			editor: null,
			getFile: () => null,
			onMarkdownScroll: () => {},
			syncScroll: () => {},
			getMode: () => 'source',
			requestSave: () => {},
			save: () => {},
		};

		this.editMode = new MarkdownEditModeBase(app, container, owner);

		this.scope = new Scope(app.scope);
		this.scope.register(['Mod'], 'Enter', () => true);

		owner.editMode = this.editMode;
		owner.editor = this.editMode.editor;

		this.editMode.set(String(options.value || ''), false);

		// Protect from external deactivation
		const origUnload = this.editMode.unload.bind(this.editMode);
		this.editMode.unload = () => {
			if (this._destroyed) origUnload();
		};
		if (typeof this.editMode.hide === 'function') {
			this.editMode.hide = () => {};
		}

		// Monkey-patch setActiveLeaf
		const editMode = this.editMode;
		const origSetActiveLeaf = app.workspace.setActiveLeaf;
		const patchedSetActiveLeaf = function (this: any, leaf: any) {
			if (editMode.activeCM?.hasFocus) return;
			return origSetActiveLeaf.apply(this, arguments as any);
		};
		app.workspace.setActiveLeaf = patchedSetActiveLeaf as any;
		editMode.register(() => {
			if ((app.workspace as any).setActiveLeaf === patchedSetActiveLeaf) {
				app.workspace.setActiveLeaf = origSetActiveLeaf;
			}
		});

		// onUpdate callback
		const origOnUpdate = this.editMode.onUpdate.bind(this.editMode);
		this.editMode.onUpdate = (viewUpdate: any, changed: boolean) => {
			if (this._destroyed) return;
			try { origOnUpdate(viewUpdate, changed); } catch { /* ignore */ }

			if (changed && options.onChange) {
				options.onChange(this.value);
			}
		};

		// Focus management
		const cm = this.editMode.editor?.cm as EditorView | undefined;
		if (cm) {
			cm.contentDOM.addEventListener('focusin', () => {
				app.keymap.pushScope(this.scope);
				(app.workspace as any).activeEditor = owner;
			});

			cm.contentDOM.addEventListener('blur', () => {
				app.keymap.popScope(this.scope);
				options.onBlur?.();
			});

			this._observer = new MutationObserver(() => {
				if (!this._destroyed && cm.contentDOM.contentEditable !== 'true') {
					cm.contentDOM.contentEditable = 'true';
				}
			});
			this._observer.observe(cm.contentDOM, {
				attributes: true,
				attributeFilter: ['contenteditable']
			});

			this.containerEl.addEventListener('mousedown', (e) => {
				if (this._destroyed) return;
				if (cm.contentDOM.contentEditable !== 'true') {
					cm.contentDOM.contentEditable = 'true';
				}
				if (!cm.contentDOM.contains(e.target as Node)) {
					e.preventDefault();
					cm.focus();
				}
			});

			if (options.placeholder) {
				cm.dispatch({
					effects: StateEffect.appendConfig.of([cmPlaceholder(options.placeholder)])
				});
			}
		}
	}

	get value(): string {
		return this.editMode?.editor?.cm?.state?.doc?.toString() ?? '';
	}

	focus() {
		this.editMode?.editor?.cm?.focus();
	}

	destroy() {
		if (this._destroyed) return;
		this._destroyed = true;
		if (this.editMode) {
			this.editMode.onUpdate = () => {};
		}
		this._observer?.disconnect();
		this._observer = null;
		this.app.keymap.popScope(this.scope);
		this.app.workspace.activeEditor = null;
		try {
			if (this.editMode?._loaded) this.editMode.unload();
		} catch { /* ignore */ }
		this.containerEl.empty();
	}
}

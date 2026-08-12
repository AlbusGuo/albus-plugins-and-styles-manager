import { TextAreaComponent } from 'obsidian';

interface InlineNoteEditorOptions {
	value: string;
	placeholder: string;
	emptyText: string;
	onSave: (value: string) => Promise<void>;
	onSaved: () => void;
}

export function renderInlineNoteEditor(
	wrapperEl: HTMLElement,
	options: InlineNoteEditorOptions
): void {
	for (const eventName of ['mousedown', 'pointerdown', 'click']) {
		wrapperEl.addEventListener(eventName, event => event.stopPropagation());
	}

	const renderDisplay = (value: string) => {
		wrapperEl.removeClass('is-editing');
		wrapperEl.empty();
		const displayEl = wrapperEl.createDiv({
			cls: value ? 'albus-psm-note-display' : 'albus-psm-note-display is-empty'
		});
		displayEl.createSpan('albus-psm-note-dot');
		displayEl.createSpan({ text: value || options.emptyText });
		displayEl.addEventListener('click', event => {
			event.preventDefault();
			renderEditor(value);
		});
	};

	const renderEditor = (initialValue: string) => {
		wrapperEl.addClass('is-editing');
		wrapperEl.empty();
		let currentValue = initialValue;
		let settled = false;
		const textarea = new TextAreaComponent(wrapperEl)
			.setPlaceholder(options.placeholder)
			.setValue(initialValue);
		textarea.inputEl.addClass('albus-psm-note-textarea');
		textarea.inputEl.rows = 1;
		const resize = () => resizeTextArea(textarea.inputEl);
		textarea.onChange(value => {
			currentValue = value;
			resize();
		});
		resize();

		const save = async () => {
			if (settled) return;
			settled = true;
			await options.onSave(currentValue);
			renderDisplay(currentValue);
			options.onSaved();
		};
		textarea.inputEl.addEventListener('blur', () => {
			void save();
		});
		textarea.inputEl.addEventListener('keydown', event => {
			if (event.key === 'Escape') {
				event.preventDefault();
				settled = true;
				renderDisplay(initialValue);
			} else if (
				event.key === 'Enter'
				&& !event.isComposing
				&& !event.shiftKey
			) {
				event.preventDefault();
				void save();
			}
		});
		textarea.inputEl.focus();
	};

	renderDisplay(options.value);
}

function resizeTextArea(textareaEl: HTMLTextAreaElement): void {
	textareaEl.setCssProps({ '--albus-psm-note-height': 'auto' });
	const borderHeight = textareaEl.offsetHeight - textareaEl.clientHeight;
	textareaEl.setCssProps({
		'--albus-psm-note-height': `${textareaEl.scrollHeight + borderHeight}px`
	});
}

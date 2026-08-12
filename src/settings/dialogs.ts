import { App, ButtonComponent, Modal, Setting, TextComponent } from 'obsidian';

interface TextInputOptions {
	title: string;
	label: string;
	placeholder: string;
	initialValue?: string;
	confirmText: string;
	validate: (value: string) => string | null;
}

class TextInputModal extends Modal {
	private value: string;
	private settled = false;

	constructor(
		app: App,
		private readonly options: TextInputOptions,
		private readonly resolveResult: (value: string | null) => void
	) {
		super(app);
		this.value = options.initialValue ?? '';
	}

	onOpen(): void {
		this.titleEl.setText(this.options.title);
		let textComponent: TextComponent | null = null;
		new Setting(this.contentEl)
			.setName(this.options.label)
			.addText(text => {
				textComponent = text
					.setPlaceholder(this.options.placeholder)
					.setValue(this.value)
					.onChange(value => {
						this.value = value;
					});
				text.inputEl.addEventListener('keydown', event => {
					if (event.key === 'Enter') {
						event.preventDefault();
						this.submit();
					}
				});
			});

		const actionsEl = this.contentEl.createDiv('albus-psm-dialog-actions');
		new ButtonComponent(actionsEl)
			.setButtonText('取消')
			.onClick(() => this.finish(null));
		new ButtonComponent(actionsEl)
			.setButtonText(this.options.confirmText)
			.setCta()
			.onClick(() => this.submit());

		this.containerEl.ownerDocument.defaultView?.setTimeout(
			() => textComponent?.inputEl.focus(),
			0
		);
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.settled) this.finish(null);
	}

	private submit(): void {
		const value = this.value.trim();
		const validationMessage = this.options.validate(value);
		if (validationMessage) {
			const errorEl = this.contentEl.querySelector<HTMLElement>('.albus-psm-dialog-error')
				?? this.contentEl.createDiv('albus-psm-dialog-error');
			errorEl.setText(validationMessage);
			return;
		}
		this.finish(value);
	}

	private finish(value: string | null): void {
		if (this.settled) return;
		this.settled = true;
		this.resolveResult(value);
		this.close();
	}
}

class ConfirmModal extends Modal {
	private settled = false;

	constructor(
		app: App,
		private readonly title: string,
		private readonly message: string,
		private readonly confirmText: string,
		private readonly resolveResult: (confirmed: boolean) => void
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText(this.title);
		this.contentEl.createEl('p', { text: this.message });
		const actionsEl = this.contentEl.createDiv('albus-psm-dialog-actions');
		new ButtonComponent(actionsEl)
			.setButtonText('取消')
			.onClick(() => this.finish(false));
		new ButtonComponent(actionsEl)
			.setButtonText(this.confirmText)
			.setWarning()
			.onClick(() => this.finish(true));
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.settled) this.finish(false);
	}

	private finish(confirmed: boolean): void {
		if (this.settled) return;
		this.settled = true;
		this.resolveResult(confirmed);
		this.close();
	}
}

export function requestTextInput(app: App, options: TextInputOptions): Promise<string | null> {
	return new Promise(resolve => {
		new TextInputModal(app, options, resolve).open();
	});
}

export function requestConfirmation(
	app: App,
	title: string,
	message: string,
	confirmText: string
): Promise<boolean> {
	return new Promise(resolve => {
		new ConfirmModal(app, title, message, confirmText, resolve).open();
	});
}

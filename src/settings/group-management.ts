import {
	App,
	ButtonComponent,
	ColorComponent,
	ExtraButtonComponent,
	Modal,
	Notice,
	TextComponent
} from 'obsidian';
import { DataStorage } from '../data-storage';
import type { ManagedGroupType } from '../types';

interface GroupManagementOptions {
	type: ManagedGroupType;
	dataStorage: DataStorage;
	onChanged: () => void;
	onClosed?: () => void;
}

class GroupManagementPanel {
	private readonly containerEl: HTMLElement;

	constructor(
		parent: HTMLElement,
		private readonly options: GroupManagementOptions
	) {
		this.containerEl = parent.createDiv({ cls: 'albus-psm-group-management' });
		this.render();
	}

	render(): void {
		this.containerEl.empty();

		const groups = this.getGroups();
		const customGroupKeys = Object.keys(groups).filter(
			key => key !== 'all' && key !== 'other'
		);
		const listGroupEl = this.containerEl.createDiv({
			cls: 'setting-group mod-list albus-psm-group-list'
		});

		this.renderComposer(listGroupEl, customGroupKeys.length);

		const itemsEl = listGroupEl.createDiv('setting-items');
		if (customGroupKeys.length === 0) {
			itemsEl.createDiv({
				cls: 'albus-psm-group-empty',
				text: '暂无自定义分组'
			});
			return;
		}

		for (const groupKey of customGroupKeys) {
			this.renderGroupRow(itemsEl, groupKey, groups[groupKey] ?? '');
		}
	}

	private renderComposer(parentEl: HTMLElement, groupCount: number): void {
		const headingEl = parentEl.createDiv({
			cls: 'setting-item setting-item-heading albus-psm-group-heading'
		});
		const infoEl = headingEl.createDiv('setting-item-info');
		infoEl.createDiv({
			cls: 'setting-item-name',
			text: '自定义分组'
		});
		infoEl.createDiv({
			cls: 'setting-item-description',
			text: groupCount === 0 ? '添加分组来整理项目' : `共 ${groupCount} 个分组`
		});

		const controlsEl = headingEl.createDiv({
			cls: 'setting-item-control albus-psm-group-composer-controls'
		});
		let newGroupName = '';
		let adding = false;
		const nameInput = new TextComponent(controlsEl)
			.setPlaceholder('输入分组名称')
			.onChange(value => {
				newGroupName = value;
			});
		nameInput.inputEl.setAttribute('aria-label', '新分组名称');

		const addButton = new ButtonComponent(controlsEl)
			.setButtonText('添加')
			.setCta();
		const addGroup = async () => {
			if (adding) return;
			adding = true;
			addButton.setDisabled(true);
			try {
				await this.addGroup(newGroupName);
			} finally {
				adding = false;
				addButton.setDisabled(false);
			}
		};
		nameInput.inputEl.addEventListener('keydown', event => {
			if (event.key === 'Enter' && !event.isComposing) {
				event.preventDefault();
				void addGroup();
			}
		});
		addButton.onClick(() => {
			void addGroup();
		});
	}

	private renderGroupRow(
		parentEl: HTMLElement,
		groupKey: string,
		groupName: string
	): void {
		const rowEl = parentEl.createDiv({
			cls: 'setting-item albus-psm-group-row'
		});
		const infoEl = rowEl.createDiv('setting-item-info');
		const nameEl = infoEl.createDiv({
			cls: 'setting-item-name',
			text: groupName
		});
		const usageCount = this.getGroupUsageCount(groupKey);
		infoEl.createDiv({
			cls: 'setting-item-description',
			text: `${usageCount} ${this.options.type === 'plugin' ? '个插件' : '个片段'}`
		});

		const actionsEl = rowEl.createDiv({
			cls: 'setting-item-control albus-psm-group-row-actions'
		});
		const currentColor = this.getGroupColor(groupKey);
		new ColorComponent(actionsEl)
			.setValue(currentColor || '#7f6df2')
			.onChange(async value => {
				await this.saveGroupColor(groupKey, value);
				this.options.onChanged();
			});
		actionsEl.querySelector<HTMLInputElement>('input[type="color"]')
			?.setAttribute('aria-label', `分组颜色: ${groupName}`);

		new ExtraButtonComponent(actionsEl)
			.setIcon('pencil')
			.setTooltip('重命名分组')
			.onClick(() => {
				this.beginRename(nameEl, groupKey, groupName);
			});
		new ExtraButtonComponent(actionsEl)
			.setIcon('rotate-ccw')
			.setTooltip('重置为默认颜色')
			.onClick(async () => {
				await this.saveGroupColor(groupKey, '');
				this.render();
				this.options.onChanged();
			});
		new ExtraButtonComponent(actionsEl)
			.setIcon('trash-2')
			.setTooltip('删除分组')
			.onClick(async () => {
				await this.deleteGroup(groupKey);
			});
	}

	private beginRename(nameEl: HTMLElement, groupKey: string, groupName: string): void {
		nameEl.empty();
		nameEl.addClass('is-editing');
		let pendingName = groupName;
		let finished = false;
		const nameInput = new TextComponent(nameEl)
			.setValue(groupName)
			.setPlaceholder('分组名称')
			.onChange(value => {
				pendingName = value;
			});
		nameInput.inputEl.setAttribute('aria-label', `分组名称: ${groupName}`);

		const commit = async () => {
			if (finished) return;
			finished = true;
			await this.renameGroup(groupKey, pendingName);
		};
		nameInput.inputEl.addEventListener('keydown', event => {
			if (event.key === 'Enter' && !event.isComposing) {
				event.preventDefault();
				void commit();
			} else if (event.key === 'Escape') {
				event.preventDefault();
				finished = true;
				this.render();
			}
		});
		nameInput.inputEl.addEventListener('blur', () => {
			void commit();
		});
		nameInput.inputEl.focus();
		nameInput.inputEl.select();
	}

	private getGroups(): Record<string, string> {
		return this.options.dataStorage.getGroups(this.options.type);
	}

	private getGroupUsageCount(groupKey: string): number {
		return this.options.dataStorage.getGroupUsageCount(this.options.type, groupKey);
	}

	private getGroupColor(groupKey: string): string {
		return this.options.dataStorage.getGroupColor(this.options.type, groupKey);
	}

	private async saveGroupColor(groupKey: string, color: string): Promise<void> {
		await this.options.dataStorage.saveGroupColor(this.options.type, groupKey, color);
	}

	private async addGroup(rawName: string): Promise<void> {
		const groupName = rawName.trim();
		if (!groupName) {
			new Notice('分组名称不能为空');
			return;
		}

		const groupKey = groupName.toLocaleLowerCase().replace(/\s+/g, '_');
		const groups = this.getGroups();
		if (groups[groupKey]) {
			new Notice('分组已存在');
			return;
		}

		const updatedGroups = { ...groups, [groupKey]: groupName };
		await this.options.dataStorage.updateGroups(this.options.type, updatedGroups);

		new Notice(`已添加分组 "${groupName}"`);
		this.render();
		this.options.onChanged();
	}

	private async renameGroup(groupKey: string, rawName: string): Promise<void> {
		const groupName = rawName.trim();
		const groups = this.getGroups();
		const previousName = groups[groupKey] ?? '';

		if (!groupName) {
			new Notice('分组名称不能为空');
			this.render();
			return;
		}
		if (groupName === previousName) {
			this.render();
			return;
		}

		const updatedGroups = { ...groups, [groupKey]: groupName };
		await this.options.dataStorage.updateGroups(this.options.type, updatedGroups);

		new Notice('分组名称已更新');
		this.render();
		this.options.onChanged();
	}

	private async deleteGroup(groupKey: string): Promise<void> {
		await this.options.dataStorage.deleteGroup(this.options.type, groupKey);
		new Notice('已删除分组');
		this.render();
		this.options.onChanged();
	}
}

export class GroupManagementModal extends Modal {
	constructor(
		app: App,
		private readonly options: GroupManagementOptions
	) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.addClass('albus-psm-group-modal');
		this.titleEl.setText(
			this.options.type === 'plugin' ? '管理插件分组' : '管理 CSS 片段分组'
		);
		new GroupManagementPanel(this.contentEl, this.options);
	}

	onClose(): void {
		this.contentEl.empty();
		this.options.onClosed?.();
	}
}

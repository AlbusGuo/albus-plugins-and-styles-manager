import {
	App,
	ExtraButtonComponent,
	Menu,
	Notice,
	normalizePath
} from 'obsidian';
import { DataStorage } from '../data-storage';
import { asInternalApp } from '../internal-api';
import { requestConfirmation, requestTextInput } from './dialogs';
import { SettingsFilterBar } from './filter-bar';
import { GroupManagementModal } from './group-management';
import { renderInlineNoteEditor } from './inline-note-editor';

const ROW_OWNER = 'css-row';
const ACTIONS_ROLE = 'row-actions';
const SNIPPET_NAME_ATTRIBUTE = 'data-albus-psm-snippet-name';

export class CSSPageEnhancer {
	private rootEl: HTMLElement | null = null;
	private listGroupEl: HTMLElement | null = null;
	private filterBar: SettingsFilterBar | null = null;
	private groupModal: GroupManagementModal | null = null;

	constructor(
		private readonly app: App,
		private readonly dataStorage: DataStorage,
		private readonly requestOfficialReload: () => void
	) {}

	enhance(rootEl: HTMLElement): void {
		if (this.rootEl !== rootEl) {
			this.cleanup();
			this.rootEl = rootEl;
		}

		const listGroupEl = this.findSnippetGroup(rootEl);
		if (!listGroupEl) return;

		if (this.listGroupEl !== listGroupEl) {
			this.listGroupEl = listGroupEl;
			this.filterBar = null;
		}

		this.ensureToolbar(listGroupEl);
		const rows = this.getRows(listGroupEl);
		for (const rowEl of rows) {
			this.enhanceRow(rowEl);
		}
		this.applyFilters(rows);
	}

	cleanup(): void {
		this.rootEl?.querySelectorAll<HTMLElement>('[data-albus-psm-owned]').forEach(
			element => element.remove()
		);
		this.rootEl?.querySelectorAll<HTMLElement>('[data-albus-psm-css-enhanced]').forEach(element => {
			element.removeAttribute('data-albus-psm-css-enhanced');
			element.removeAttribute(SNIPPET_NAME_ATTRIBUTE);
		});
		this.rootEl?.querySelectorAll<HTMLElement>('.albus-psm-filtered-out').forEach(
			element => element.removeClass('albus-psm-filtered-out')
		);
		this.rootEl = null;
		this.listGroupEl = null;
		this.filterBar = null;
		this.groupModal?.close();
		this.groupModal = null;
	}

	private findSnippetGroup(rootEl: HTMLElement): HTMLElement | null {
		const groups = Array.from(
			rootEl.querySelectorAll<HTMLElement>('.setting-group.mod-list')
		).filter(groupEl => (
			groupEl.querySelector('.setting-group-search')
			&& groupEl.querySelector('.setting-items')
		));
		return groups[0] ?? null;
	}

	private getRows(listGroupEl: HTMLElement): HTMLElement[] {
		return Array.from(
			listGroupEl.querySelectorAll<HTMLElement>('.setting-items > .setting-item.mod-toggle')
		);
	}

	private ensureToolbar(listGroupEl: HTMLElement): void {
		const searchEl = listGroupEl.querySelector<HTMLElement>('.setting-group-search');
		if (!searchEl) return;
		const headerControlEl = listGroupEl.querySelector<HTMLElement>(
			':scope > .setting-item.setting-item-heading > .setting-item-control'
		);
		if (!headerControlEl) return;

		if (!this.filterBar?.containerEl.isConnected) {
			this.filterBar = new SettingsFilterBar(headerControlEl, {
				groups: this.dataStorage.getSettings().cssGroups,
				countNoun: '个片段',
				onChange: () => this.applyFilters(),
				onManageGroups: () => this.openGroupManagement(),
				onCreate: () => {
					void this.createSnippet();
				}
			});
		}
		this.filterBar.mount(headerControlEl);
	}

	private openGroupManagement(): void {
		this.groupModal?.close();
		this.groupModal = new GroupManagementModal(this.app, {
			type: 'css',
			dataStorage: this.dataStorage,
			onChanged: () => this.refreshOwnedContent(),
			onClosed: () => {
				this.groupModal = null;
			}
		});
		this.groupModal.open();
	}

	private enhanceRow(rowEl: HTMLElement): void {
		const infoEl = rowEl.querySelector<HTMLElement>('.setting-item-info');
		const nameEl = rowEl.querySelector<HTMLElement>('.setting-item-name');
		const controlEl = rowEl.querySelector<HTMLElement>('.setting-item-control');
		const snippetName = this.readOriginalSnippetName(rowEl, nameEl);
		if (!infoEl || !nameEl || !controlEl || !snippetName) return;
		const metadata = this.dataStorage.getCSSSnippetMetadata(snippetName);
		if (
			rowEl.hasAttribute('data-albus-psm-css-enhanced')
			&& this.isRowEnhancementComplete(rowEl, metadata.group)
		) return;

		this.removeRowEnhancement(rowEl);
		rowEl.setAttribute('data-albus-psm-css-enhanced', 'true');
		rowEl.setAttribute(SNIPPET_NAME_ATTRIBUTE, snippetName);

		this.addGroupBadge(nameEl, metadata.group);
		this.addDescriptionEditor(infoEl, snippetName, metadata.description);
		this.addActions(controlEl, rowEl, snippetName, metadata.group);
	}

	private readOriginalSnippetName(
		rowEl: HTMLElement,
		nameEl: HTMLElement | null
	): string {
		const storedName = rowEl.getAttribute(SNIPPET_NAME_ATTRIBUTE);
		if (storedName) return storedName;
		return nameEl?.firstChild?.textContent?.trim() ?? '';
	}

	private addGroupBadge(nameEl: HTMLElement, groupKey: string): void {
		const settings = this.dataStorage.getSettings();
		const groupName = settings.cssGroups[groupKey];
		if (!groupName || groupKey === 'all') return;

		const badgeEl = nameEl.createSpan({
			cls: 'albus-psm-group-badge',
			text: groupName,
			attr: { 'data-albus-psm-owned': ROW_OWNER }
		});
		const color = this.dataStorage.getCSSGroupColor(groupKey);
		if (color) badgeEl.setCssProps({ '--albus-psm-group-color': color });
	}

	private addDescriptionEditor(infoEl: HTMLElement, snippetName: string, description: string): void {
		const wrapperEl = infoEl.createDiv({
			cls: 'setting-item-description albus-psm-note-field',
			attr: { 'data-albus-psm-owned': ROW_OWNER }
		});
		renderInlineNoteEditor(wrapperEl, {
			value: description,
			placeholder: '输入片段描述',
			emptyText: '点击添加描述',
			onSave: value => this.dataStorage.saveCSSSnippetMetadata(
				snippetName,
				{ description: value }
			),
			onSaved: () => this.applyFilters()
		});
	}

	private addActions(
		controlEl: HTMLElement,
		rowEl: HTMLElement,
		snippetName: string,
		currentGroup: string
	): void {
		const actionsEl = controlEl.createSpan({
			cls: 'albus-psm-row-actions',
			attr: {
				'data-albus-psm-owned': ROW_OWNER,
				'data-albus-psm-role': ACTIONS_ROLE
			}
		});
		controlEl.prepend(actionsEl);

		const groupButton = new ExtraButtonComponent(actionsEl)
			.setIcon('tag')
			.setTooltip('设置分组');
		groupButton.extraSettingsEl.addEventListener('click', event => {
			event.preventDefault();
			event.stopPropagation();
			this.showGroupMenu(event, rowEl, snippetName, currentGroup);
		});

		new ExtraButtonComponent(actionsEl)
			.setIcon('file-code')
			.setTooltip('打开文件')
			.onClick(() => {
				const path = asInternalApp(this.app).customCss.getSnippetPath(snippetName);
				void Promise.resolve(asInternalApp(this.app).openWithDefaultApp(path));
			});

		new ExtraButtonComponent(actionsEl)
			.setIcon('pencil')
			.setTooltip('重命名')
			.onClick(() => {
				void this.renameSnippet(snippetName);
			});

		new ExtraButtonComponent(actionsEl)
			.setIcon('trash-2')
			.setTooltip('删除片段')
			.onClick(() => {
				void this.deleteSnippet(snippetName);
			});
	}

	private showGroupMenu(
		event: MouseEvent,
		rowEl: HTMLElement,
		snippetName: string,
		currentGroup: string
	): void {
		const menu = new Menu();
		const groups = this.dataStorage.getSettings().cssGroups;
		for (const [groupKey, groupName] of Object.entries(groups)) {
			if (groupKey === 'all') continue;
			menu.addItem(item => {
				item.setTitle(groupName)
					.setChecked(currentGroup === groupKey)
					.onClick(async () => {
						await this.dataStorage.saveCSSSnippetMetadata(snippetName, { group: groupKey });
						this.refreshRow(rowEl);
						this.applyFilters();
					});
			});
		}
		menu.showAtMouseEvent(event);
	}

	private async createSnippet(): Promise<void> {
		const requestedName = await requestTextInput(this.app, {
			title: '新建 CSS 片段',
			label: '片段名称',
			placeholder: '输入片段名称',
			confirmText: '创建',
			validate: value => this.validateSnippetName(value)
		});
		if (!requestedName) return;

		const snippetName = requestedName.replace(/\.css$/i, '');
		const customCss = asInternalApp(this.app).customCss;
		const snippetsFolder = normalizePath(customCss.getSnippetsFolder());
		const filePath = normalizePath(`${snippetsFolder}/${snippetName}.css`);

		try {
			if (!await this.app.vault.adapter.exists(snippetsFolder)) {
				await this.app.vault.adapter.mkdir(snippetsFolder);
			}
			if (await this.app.vault.adapter.exists(filePath)) {
				new Notice('该 CSS 片段已存在');
				return;
			}

			await this.app.vault.adapter.write(
				filePath,
				`/* ${snippetName} */\n\n/* 在此处添加你的 CSS 代码 */\n`
			);
			await customCss.requestLoadSnippets();
			await Promise.resolve(asInternalApp(this.app).openWithDefaultApp(filePath));
			new Notice(`CSS 片段“${snippetName}”已创建并打开`);
			this.requestOfficialReload();
		} catch (error) {
			console.error('创建 CSS 片段失败:', error);
			new Notice('创建失败');
		}
	}

	private async renameSnippet(oldName: string): Promise<void> {
		const requestedName = await requestTextInput(this.app, {
			title: '重命名 CSS 片段',
			label: '新名称',
			placeholder: '输入新的片段名称',
			initialValue: oldName,
			confirmText: '重命名',
			validate: value => this.validateSnippetName(value)
		});
		if (!requestedName) return;

		const newName = requestedName.replace(/\.css$/i, '');
		if (newName === oldName) return;

		const customCss = asInternalApp(this.app).customCss;
		if (customCss.snippets.includes(newName)) {
			new Notice(`CSS 片段“${newName}”已存在`);
			return;
		}

		try {
			const oldPath = customCss.getSnippetPath(oldName);
			const newPath = normalizePath(`${customCss.getSnippetsFolder()}/${newName}.css`);
			await this.app.vault.adapter.rename(oldPath, newPath);

			if (customCss.enabledSnippets.has(oldName)) {
				customCss.setCssEnabledStatus(oldName, false);
				customCss.setCssEnabledStatus(newName, true);
			}

			await customCss.requestLoadSnippets();
			await this.dataStorage.moveCSSSnippetMetadata(oldName, newName);
			new Notice(`CSS 片段已重命名为“${newName}”`);
			this.requestOfficialReload();
		} catch (error) {
			console.error('重命名 CSS 片段失败:', error);
			new Notice('重命名失败');
		}
	}

	private async deleteSnippet(snippetName: string): Promise<void> {
		const confirmed = await requestConfirmation(
			this.app,
			'删除 CSS 片段',
			`确定要删除 CSS 片段“${snippetName}”吗？此操作无法撤销。`,
			'删除'
		);
		if (!confirmed) return;

		try {
			const customCss = asInternalApp(this.app).customCss;
			if (customCss.enabledSnippets.has(snippetName)) {
				customCss.setCssEnabledStatus(snippetName, false);
			}
			await this.app.vault.adapter.remove(customCss.getSnippetPath(snippetName));
			await this.dataStorage.deleteCSSSnippetMetadata(snippetName);
			await customCss.requestLoadSnippets();
			new Notice(`CSS 片段“${snippetName}”已删除`);
			this.requestOfficialReload();
		} catch (error) {
			console.error('删除 CSS 片段失败:', error);
			new Notice('删除失败');
		}
	}

	private validateSnippetName(value: string): string | null {
		const cleanName = value.trim().replace(/\.css$/i, '');
		if (!cleanName) return '请输入 CSS 片段名称';
		if (!/^[a-zA-Z0-9_\-\u4e00-\u9fa5\s]+$/.test(cleanName)) {
			return '名称只能包含字母、数字、下划线、横线、中文和空格';
		}
		return null;
	}

	private applyFilters(rows?: HTMLElement[]): void {
		if (!this.listGroupEl || !this.filterBar) return;

		const state = this.filterBar.getState();
		const counts: Record<string, number> = {};
		for (const rowEl of rows ?? this.getRows(this.listGroupEl)) {
			const snippetName = rowEl.getAttribute(SNIPPET_NAME_ATTRIBUTE)
				?? this.readOriginalSnippetName(
					rowEl,
					rowEl.querySelector<HTMLElement>('.setting-item-name')
				);
			if (!snippetName) continue;

			const group = this.dataStorage.getCSSSnippetMetadata(snippetName).group;
			const enabled = rowEl.querySelector('.checkbox-container')?.hasClass('is-enabled') ?? false;
			const matchesStatus = state.filterEnabled === 'all'
				|| (state.filterEnabled === 'enabled' && enabled)
				|| (state.filterEnabled === 'disabled' && !enabled);
			if (matchesStatus) {
				counts.all = (counts.all ?? 0) + 1;
				counts[group] = (counts[group] ?? 0) + 1;
			}

			const matchesGroup = state.selectedGroup === 'all' || group === state.selectedGroup;
			rowEl.toggleClass('albus-psm-filtered-out', !(matchesStatus && matchesGroup));
		}

		this.filterBar.updateGroups(this.dataStorage.getSettings().cssGroups, counts);
	}

	private refreshRow(rowEl: HTMLElement): void {
		this.removeRowEnhancement(rowEl);
		this.enhanceRow(rowEl);
	}

	private isRowEnhancementComplete(rowEl: HTMLElement, groupKey: string): boolean {
		const hasNote = Boolean(rowEl.querySelector(
			`.albus-psm-note-field[data-albus-psm-owned="${ROW_OWNER}"]`
		));
		const hasActions = Boolean(rowEl.querySelector(
			`[data-albus-psm-owned="${ROW_OWNER}"][data-albus-psm-role="${ACTIONS_ROLE}"]`
		));
		const groupName = this.dataStorage.getSettings().cssGroups[groupKey];
		const needsBadge = Boolean(groupName && groupKey !== 'all');
		const hasBadge = Boolean(rowEl.querySelector(
			`.albus-psm-group-badge[data-albus-psm-owned="${ROW_OWNER}"]`
		));
		return hasNote && hasActions && hasBadge === needsBadge;
	}

	private removeRowEnhancement(rowEl: HTMLElement): void {
		rowEl.querySelectorAll<HTMLElement>(`[data-albus-psm-owned="${ROW_OWNER}"]`).forEach(
			element => element.remove()
		);
		rowEl.removeAttribute('data-albus-psm-css-enhanced');
	}

	private refreshOwnedContent(): void {
		if (!this.listGroupEl) return;
		const rows = this.getRows(this.listGroupEl);
		for (const rowEl of rows) {
			this.refreshRow(rowEl);
		}
		this.applyFilters(rows);
	}
}

import { App, ExtraButtonComponent, Menu } from 'obsidian';
import { DataStorage } from '../data-storage';
import { GroupManagementModal } from './group-management';
import { SettingsFilterBar } from './filter-bar';
import { renderInlineNoteEditor } from './inline-note-editor';

const ROW_OWNER = 'plugin-row';
const GROUP_BUTTON_ROLE = 'group-button';

export class PluginPageEnhancer {
	private rootEl: HTMLElement | null = null;
	private listGroupEl: HTMLElement | null = null;
	private filterBar: SettingsFilterBar | null = null;
	private groupModal: GroupManagementModal | null = null;

	constructor(
		private readonly app: App,
		private readonly dataStorage: DataStorage
	) {}

	enhance(rootEl: HTMLElement): void {
		if (this.rootEl !== rootEl) {
			this.cleanup();
			this.rootEl = rootEl;
		}

		const listGroupEl = this.findInstalledPluginsGroup(rootEl);
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
		this.rootEl?.querySelectorAll<HTMLElement>('[data-albus-psm-plugin-enhanced]').forEach(
			element => element.removeAttribute('data-albus-psm-plugin-enhanced')
		);
		this.rootEl?.querySelectorAll<HTMLElement>('.albus-psm-filtered-out').forEach(
			element => element.removeClass('albus-psm-filtered-out')
		);
		this.rootEl = null;
		this.listGroupEl = null;
		this.filterBar = null;
		this.groupModal?.close();
		this.groupModal = null;
	}

	private findInstalledPluginsGroup(rootEl: HTMLElement): HTMLElement | null {
		const groups = Array.from(
			rootEl.querySelectorAll<HTMLElement>('.setting-group.mod-list')
		).filter(groupEl => (
			groupEl.querySelector('.setting-group-search')
			&& groupEl.querySelector('.setting-items')
		));
		return groups[groups.length - 1] ?? null;
	}

	private getRows(listGroupEl: HTMLElement): HTMLElement[] {
		return Array.from(
			listGroupEl.querySelectorAll<HTMLElement>('.setting-items > .setting-item[data-plugin-id]')
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
				groups: this.dataStorage.getSettings().groups,
				countNoun: '个插件',
				onChange: () => this.applyFilters(),
				onManageGroups: () => this.openGroupManagement()
			});
		}
		this.filterBar.mount(headerControlEl);
	}

	private openGroupManagement(): void {
		this.groupModal?.close();
		this.groupModal = new GroupManagementModal(this.app, {
			type: 'plugin',
			dataStorage: this.dataStorage,
			onChanged: () => this.refreshOwnedContent(),
			onClosed: () => {
				this.groupModal = null;
			}
		});
		this.groupModal.open();
	}

	private enhanceRow(rowEl: HTMLElement): void {
		const pluginId = rowEl.dataset.pluginId;
		const infoEl = rowEl.querySelector<HTMLElement>('.setting-item-info');
		const nameEl = rowEl.querySelector<HTMLElement>('.setting-item-name');
		const controlEl = rowEl.querySelector<HTMLElement>('.setting-item-control');
		if (!pluginId || !infoEl || !nameEl || !controlEl) return;
		const metadata = this.dataStorage.getPluginMetadata(pluginId);
		if (
			rowEl.hasAttribute('data-albus-psm-plugin-enhanced')
			&& this.isRowEnhancementComplete(rowEl, metadata.group)
		) return;

		this.removeRowEnhancement(rowEl);
		rowEl.setAttribute('data-albus-psm-plugin-enhanced', 'true');

		this.addGroupBadge(nameEl, metadata.group);
		this.addRemarkEditor(infoEl, pluginId, metadata.remark);
		this.addGroupButton(controlEl, rowEl, pluginId, metadata.group);
	}

	private addGroupBadge(nameEl: HTMLElement, groupKey: string): void {
		const settings = this.dataStorage.getSettings();
		const groupName = settings.groups[groupKey];
		if (!groupName || groupKey === 'all') return;

		const badgeEl = nameEl.createSpan({
			cls: 'albus-psm-group-badge',
			text: groupName,
			attr: { 'data-albus-psm-owned': ROW_OWNER }
		});
		const color = this.dataStorage.getGroupColor(groupKey);
		if (color) badgeEl.setCssProps({ '--albus-psm-group-color': color });
	}

	private addRemarkEditor(infoEl: HTMLElement, pluginId: string, remark: string): void {
		const wrapperEl = infoEl.createDiv({
			cls: 'setting-item-description albus-psm-note-field',
			attr: { 'data-albus-psm-owned': ROW_OWNER }
		});
		renderInlineNoteEditor(wrapperEl, {
			value: remark,
			placeholder: '输入插件备注',
			emptyText: '点击添加备注',
			onSave: value => this.dataStorage.savePluginMetadata(pluginId, { remark: value }),
			onSaved: () => this.applyFilters()
		});
	}

	private addGroupButton(
		controlEl: HTMLElement,
		rowEl: HTMLElement,
		pluginId: string,
		currentGroup: string
	): void {
		const button = new ExtraButtonComponent(controlEl)
			.setIcon('tag')
			.setTooltip('设置分组');
		button.extraSettingsEl.setAttribute('data-albus-psm-owned', ROW_OWNER);
		button.extraSettingsEl.setAttribute('data-albus-psm-role', GROUP_BUTTON_ROLE);
		controlEl.prepend(button.extraSettingsEl);
		button.extraSettingsEl.addEventListener('click', event => {
			event.preventDefault();
			event.stopPropagation();
			const menu = new Menu();
			const groups = this.dataStorage.getSettings().groups;
			for (const [groupKey, groupName] of Object.entries(groups)) {
				if (groupKey === 'all') continue;
				menu.addItem(item => {
					item.setTitle(groupName)
						.setChecked(currentGroup === groupKey)
						.onClick(async () => {
							await this.dataStorage.savePluginMetadata(pluginId, { group: groupKey });
							this.refreshRow(rowEl);
							this.applyFilters();
						});
				});
			}
			menu.showAtMouseEvent(event);
		});
	}

	private applyFilters(rows?: HTMLElement[]): void {
		if (!this.listGroupEl || !this.filterBar) return;

		const state = this.filterBar.getState();
		const counts: Record<string, number> = {};
		for (const rowEl of rows ?? this.getRows(this.listGroupEl)) {
			const pluginId = rowEl.dataset.pluginId;
			if (!pluginId) continue;

			const group = this.dataStorage.getPluginMetadata(pluginId).group;
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

		this.filterBar.updateGroups(this.dataStorage.getSettings().groups, counts);
	}

	private refreshRow(rowEl: HTMLElement): void {
		this.removeRowEnhancement(rowEl);
		this.enhanceRow(rowEl);
	}

	private isRowEnhancementComplete(rowEl: HTMLElement, groupKey: string): boolean {
		const hasNote = Boolean(rowEl.querySelector(
			`.albus-psm-note-field[data-albus-psm-owned="${ROW_OWNER}"]`
		));
		const hasGroupButton = Boolean(rowEl.querySelector(
			`[data-albus-psm-owned="${ROW_OWNER}"][data-albus-psm-role="${GROUP_BUTTON_ROLE}"]`
		));
		const groupName = this.dataStorage.getSettings().groups[groupKey];
		const needsBadge = Boolean(groupName && groupKey !== 'all');
		const hasBadge = Boolean(rowEl.querySelector(
			`.albus-psm-group-badge[data-albus-psm-owned="${ROW_OWNER}"]`
		));
		return hasNote && hasGroupButton && hasBadge === needsBadge;
	}

	private removeRowEnhancement(rowEl: HTMLElement): void {
		rowEl.querySelectorAll<HTMLElement>(`[data-albus-psm-owned="${ROW_OWNER}"]`).forEach(
			element => element.remove()
		);
		rowEl.removeAttribute('data-albus-psm-plugin-enhanced');
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

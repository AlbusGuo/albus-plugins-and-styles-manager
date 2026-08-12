import { DropdownComponent, ExtraButtonComponent } from 'obsidian';
import { FilterType } from '../types';

interface FilterBarState {
	filterEnabled: FilterType;
	selectedGroup: string;
}

interface FilterBarOptions {
	groups: Record<string, string>;
	countNoun: string;
	onChange: () => void;
	onManageGroups: () => void;
	onCreate?: () => void;
}

export class SettingsFilterBar {
	readonly containerEl: HTMLElement;

	private readonly groupDropdown: DropdownComponent;
	private readonly statusDropdown: DropdownComponent;
	private readonly countEl: HTMLElement;
	private readonly options: FilterBarOptions;
	private actionElements: HTMLElement[] = [];
	private actionsParentEl: HTMLElement | null = null;
	private groupOptionsSignature = '';

	constructor(parent: HTMLElement, options: FilterBarOptions) {
		this.options = options;
		this.containerEl = parent.createDiv({
			cls: 'albus-psm-settings-toolbar',
			attr: { 'data-albus-psm-owned': 'toolbar' }
		});

		const filtersEl = this.containerEl.createDiv('albus-psm-settings-toolbar-filters');
		this.countEl = filtersEl.createDiv({
			cls: 'albus-psm-filter-count',
			attr: {
				'aria-live': 'polite',
				role: 'status'
			}
		});

		this.groupDropdown = new DropdownComponent(filtersEl);
		this.groupDropdown.selectEl.setAttribute('aria-label', '按分组筛选');
		this.groupDropdown.onChange(() => this.options.onChange());

		this.statusDropdown = new DropdownComponent(filtersEl)
			.addOption('all', '全部状态')
			.addOption('enabled', '已启用')
			.addOption('disabled', '未启用')
			.setValue('all');
		this.statusDropdown.selectEl.setAttribute('aria-label', '按启用状态筛选');
		this.statusDropdown.onChange(() => this.options.onChange());

		this.updateGroups(options.groups, {});
	}

	mount(parentEl: HTMLElement): void {
		if (
			this.containerEl.parentElement !== parentEl
			|| parentEl.firstElementChild !== this.containerEl
		) {
			parentEl.prepend(this.containerEl);
		}

		if (
			this.actionsParentEl === parentEl
			&& this.actionElements.length > 0
			&& this.actionElements.every(element => element.isConnected)
		) return;

		for (const element of this.actionElements) element.remove();
		this.actionElements = [];
		this.actionsParentEl = parentEl;

		this.addAction(parentEl, 'tags', '管理分组', () => this.options.onManageGroups());
		if (this.options.onCreate) {
			this.addAction(parentEl, 'square-plus', '新建 CSS 片段', () => {
				this.options.onCreate?.();
			});
		}
	}

	getState(): FilterBarState {
		return {
			filterEnabled: this.statusDropdown.getValue() as FilterType,
			selectedGroup: this.groupDropdown.getValue()
		};
	}

	updateGroups(groups: Record<string, string>, counts: Record<string, number>): void {
		const sortedEntries = Object.entries(groups).sort(([left], [right]) => {
			if (left === 'all') return -1;
			if (right === 'all') return 1;
			if (left === 'other') return 1;
			if (right === 'other') return -1;
			return 0;
		});
		const options = sortedEntries.map(([key, name]) => [key, name] as const);
		const signature = JSON.stringify(options);

		if (signature !== this.groupOptionsSignature) {
			const previousValue = this.groupDropdown.getValue();
			this.groupDropdown.selectEl.empty();
			for (const [key, label] of options) {
				this.groupDropdown.addOption(key, label);
			}

			const nextValue = previousValue in groups ? previousValue : 'all';
			this.groupDropdown.setValue(nextValue);
			this.groupOptionsSignature = signature;
		}

		const visibleCount = counts[this.groupDropdown.getValue()] ?? 0;
		this.countEl.setText(`${visibleCount} ${this.options.countNoun}`);
	}

	private addAction(
		parentEl: HTMLElement,
		icon: string,
		tooltip: string,
		onClick: () => void
	): void {
		const button = new ExtraButtonComponent(parentEl)
			.setIcon(icon)
			.setTooltip(tooltip)
			.onClick(onClick);
		button.extraSettingsEl.setAttribute('data-albus-psm-owned', 'toolbar-action');
		this.actionElements.push(button.extraSettingsEl);
	}
}

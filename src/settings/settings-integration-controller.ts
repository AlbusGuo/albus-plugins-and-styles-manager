import type { App } from 'obsidian';
import { DataStorage } from '../data-storage';
import { asInternalApp } from '../internal-api';
import type {
	InternalSettingManager,
	InternalSettingTab
} from '../internal-api';
import { CSSPageEnhancer } from './css-page-enhancer';
import { PluginPageEnhancer } from './plugin-page-enhancer';

const COMMUNITY_PLUGINS_TAB_ID = 'community-plugins';
const APPEARANCE_TAB_ID = 'appearance';
const OWNED_ELEMENT_SELECTOR = '[data-albus-psm-owned]';
const FILTERED_OUT_CLASS = 'albus-psm-filtered-out';
const LIFECYCLE_METHODS = [
	'onOpen',
	'onClose',
	'openTab',
	'openTabById',
	'closeActiveTab',
	'openPage',
	'closePage',
	'refreshCurrentPage'
] as const;

interface PatchedMethod {
	name: typeof LIFECYCLE_METHODS[number];
	hadOwnProperty: boolean;
	value: unknown;
	wrapper: (...args: unknown[]) => unknown;
}

export class SettingsIntegrationController {
	private readonly pluginEnhancer: PluginPageEnhancer;
	private readonly cssEnhancer: CSSPageEnhancer;
	private setting: InternalSettingManager | null = null;
	private observer: MutationObserver | null = null;
	private frameId: number | null = null;
	private cssNavigationFrameId: number | null = null;
	private patchedMethods: PatchedMethod[] = [];
	private cleanupSignature = '';

	constructor(
		private readonly app: App,
		private readonly dataStorage: DataStorage
	) {
		this.pluginEnhancer = new PluginPageEnhancer(app, dataStorage);
		this.cssEnhancer = new CSSPageEnhancer(
			app,
			dataStorage,
			() => this.reloadOfficialCSSPage()
		);
	}

	start(): void {
		if (this.setting) return;

		const setting = asInternalApp(this.app).setting;
		if (!setting?.tabContentContainer) return;

		this.setting = setting;
		this.patchLifecycleMethods(setting);

		const observerWindow = setting.tabContentContainer.ownerDocument.defaultView;
		const Observer = observerWindow?.MutationObserver ?? MutationObserver;
		this.observer = new Observer(mutations => {
			if (mutations.some(mutation => this.shouldReconcileMutation(mutation))) {
				this.scheduleReconcile();
			}
		});
		this.observer.observe(setting.tabContentContainer, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['class'],
			attributeOldValue: true
		});

		this.scheduleReconcile();
	}

	stop(): void {
		this.observer?.disconnect();
		this.observer = null;
		this.cancelCSSNavigation();
		this.cancelScheduledReconcile();
		this.restoreLifecycleMethods();
		this.pluginEnhancer.cleanup();
		this.cssEnhancer.cleanup();
		this.cleanupSignature = '';
		this.setting = null;
	}

	openCommunityPlugins(): void {
		const setting = this.setting ?? asInternalApp(this.app).setting;
		if (!setting) return;

		setting.open();
		setting.openTabById(COMMUNITY_PLUGINS_TAB_ID);
		this.scheduleReconcile();
	}

	openCSSSnippets(): void {
		const setting = this.setting ?? asInternalApp(this.app).setting;
		if (!setting) return;

		setting.open();
		setting.openTabById(APPEARANCE_TAB_ID);
		this.cancelCSSNavigation();
		this.navigateToCSSSnippetsPage(setting, 0);
		this.scheduleReconcile();
	}

	private reconcile(): void {
		const setting = this.setting;
		if (!setting || !setting.tabContentContainer.isConnected) {
			this.pluginEnhancer.cleanup();
			this.cssEnhancer.cleanup();
			return;
		}
		this.scheduleOrphanedDataCleanup();

		const activeTab = setting.activeTab;
		if (activeTab?.id === COMMUNITY_PLUGINS_TAB_ID) {
			this.cssEnhancer.cleanup();
			this.pluginEnhancer.enhance(activeTab.containerEl ?? setting.tabContentContainer);
			return;
		}

		if (activeTab?.id === APPEARANCE_TAB_ID && this.isCSSSnippetsPage(setting, activeTab)) {
			this.pluginEnhancer.cleanup();
			const pageEl = setting.getCurrentPageEl();
			if (pageEl) this.cssEnhancer.enhance(pageEl);
			return;
		}

		this.pluginEnhancer.cleanup();
		this.cssEnhancer.cleanup();
	}

	private isCSSSnippetsPage(
		setting: InternalSettingManager,
		appearanceTab: InternalSettingTab
	): boolean {
		if (setting.pageStack.length === 0) return false;

		const cssDefinition = this.getCSSSnippetsDefinition(appearanceTab);
		if (!cssDefinition || typeof cssDefinition.name !== 'string') return false;

		const currentPageEl = setting.getCurrentPageEl();
		const pageTitle = currentPageEl
			?.querySelector<HTMLElement>('.setting-page-title')
			?.textContent
			?.trim();
		return pageTitle === cssDefinition.name.trim();
	}

	private getCSSSnippetsDefinition(appearanceTab: InternalSettingTab) {
		return appearanceTab.settingItems?.find(definition => (
			typeof definition.name === 'string'
			&& Object.prototype.hasOwnProperty.call(definition, 'displayValue')
			&& Object.prototype.hasOwnProperty.call(definition, 'items')
		)) ?? null;
	}

	private navigateToCSSSnippetsPage(
		setting: InternalSettingManager,
		attempt: number
	): void {
		const appearanceTab = setting.settingTabs.find(tab => tab.id === APPEARANCE_TAB_ID);
		const cssDefinition = appearanceTab
			? this.getCSSSnippetsDefinition(appearanceTab)
			: null;
		const mappedElement = appearanceTab && cssDefinition
			? appearanceTab.getElementForDefinition?.(cssDefinition) ?? null
			: null;
		const mappedRow = mappedElement?.closest<HTMLElement>('.setting-item') ?? null;
		const cssRow = mappedRow
			?? mappedElement
			?? this.findCSSSnippetsRow(appearanceTab, cssDefinition?.name);

		if (setting.activeTab?.id === APPEARANCE_TAB_ID && cssRow) {
			cssRow.click();
			this.scheduleReconcile();
			return;
		}

		if (attempt >= 4) return;
		const view = setting.tabContentContainer.ownerDocument.defaultView ?? window;
		this.cssNavigationFrameId = view.requestAnimationFrame(() => {
			this.cssNavigationFrameId = null;
			this.navigateToCSSSnippetsPage(setting, attempt + 1);
		});
	}

	private findCSSSnippetsRow(
		appearanceTab: InternalSettingTab | undefined,
		definitionName: unknown
	): HTMLElement | null {
		if (!appearanceTab?.containerEl || typeof definitionName !== 'string') return null;
		const expectedName = definitionName.trim();
		return Array.from(
			appearanceTab.containerEl.querySelectorAll<HTMLElement>('.setting-item')
		).find(row => (
			row.querySelector<HTMLElement>('.setting-item-name')
				?.textContent
				?.trim() === expectedName
		)) ?? null;
	}

	private cancelCSSNavigation(): void {
		if (this.cssNavigationFrameId === null) return;

		const setting = this.setting ?? asInternalApp(this.app).setting;
		const view = setting?.tabContentContainer.ownerDocument.defaultView ?? window;
		view.cancelAnimationFrame(this.cssNavigationFrameId);
		this.cssNavigationFrameId = null;
	}

	private scheduleOrphanedDataCleanup(): void {
		const internalApp = asInternalApp(this.app);
		const pluginIds = Object.keys(internalApp.plugins.manifests).sort();
		const snippetNames = [...internalApp.customCss.snippets].sort();
		const signature = JSON.stringify([pluginIds, snippetNames]);
		if (signature === this.cleanupSignature) return;

		this.cleanupSignature = signature;
		void this.dataStorage.cleanupOrphanedMetadata().catch(error => {
			this.cleanupSignature = '';
			console.error('清理失效的插件与 CSS 元数据失败:', error);
		});
	}

	private reloadOfficialCSSPage(): void {
		const setting = this.setting;
		const currentPageEl = setting?.getCurrentPageEl();
		const headerControlEl = currentPageEl?.querySelector<HTMLElement>(
			'.setting-group.mod-list > .setting-item.setting-item-heading > .setting-item-control'
		);
		const refreshButton = headerControlEl
			? Array.from(headerControlEl.children).find(element => (
				element.matches('.clickable-icon')
				&& element.querySelector('svg.lucide-refresh-cw')
			)) as HTMLElement | undefined
			: undefined;

		if (refreshButton) {
			refreshButton.click();
		} else {
			setting?.refreshCurrentPage();
		}
		this.scheduleReconcile();
	}

	private shouldReconcileMutation(mutation: MutationRecord): boolean {
		const targetEl = mutation.target.nodeType === 1
			? mutation.target as Element
			: mutation.target.parentElement;
		if (targetEl?.closest(OWNED_ELEMENT_SELECTOR)) return false;

		if (mutation.type === 'attributes' && targetEl) {
			return !this.onlyFilterVisibilityChanged(targetEl, mutation.oldValue);
		}

		if (mutation.type === 'childList') {
			const removedElements = Array.from(mutation.removedNodes)
				.filter(node => node.nodeType === 1) as Element[];
			if (removedElements.some(element => element.matches(OWNED_ELEMENT_SELECTOR))) {
				return true;
			}

			const addedElements = Array.from(mutation.addedNodes)
				.filter(node => node.nodeType === 1) as Element[];
			if (
				addedElements.length > 0
				&& addedElements.every(element => (
					element.closest(OWNED_ELEMENT_SELECTOR)
				))
			) return false;
		}

		return true;
	}

	private onlyFilterVisibilityChanged(targetEl: Element, oldValue: string | null): boolean {
		const oldClasses = (oldValue ?? '')
			.split(/\s+/)
			.filter(className => className && className !== FILTERED_OUT_CLASS)
			.sort();
		const currentClasses = Array.from(targetEl.classList)
			.filter(className => className !== FILTERED_OUT_CLASS)
			.sort();
		return oldClasses.join(' ') === currentClasses.join(' ');
	}

	private scheduleReconcile(): void {
		const setting = this.setting;
		if (!setting || this.frameId !== null) return;

		const view = setting.tabContentContainer.ownerDocument.defaultView ?? window;
		this.frameId = view.requestAnimationFrame(() => {
			this.frameId = null;
			this.reconcile();
		});
	}

	private cancelScheduledReconcile(): void {
		if (this.frameId === null || !this.setting) return;

		const view = this.setting.tabContentContainer.ownerDocument.defaultView ?? window;
		view.cancelAnimationFrame(this.frameId);
		this.frameId = null;
	}

	private patchLifecycleMethods(setting: InternalSettingManager): void {
		const target = setting as unknown as Record<string, unknown>;
		for (const name of LIFECYCLE_METHODS) {
			const original = target[name];
			if (typeof original !== 'function') continue;

			const wrapper = (...args: unknown[]) => {
				const result = original.apply(setting, args) as unknown;
				this.scheduleReconcile();
				if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
					void Promise.resolve(result).finally(() => this.scheduleReconcile());
				}
				return result;
			};
			this.patchedMethods.push({
				name,
				hadOwnProperty: Object.prototype.hasOwnProperty.call(target, name),
				value: target[name],
				wrapper
			});
			target[name] = wrapper;
		}
	}

	private restoreLifecycleMethods(): void {
		if (!this.setting) return;

		const target = this.setting as unknown as Record<string, unknown>;
		for (const patched of this.patchedMethods) {
			if (target[patched.name] !== patched.wrapper) continue;

			if (patched.hadOwnProperty) {
				target[patched.name] = patched.value;
			} else {
				delete target[patched.name];
			}
		}
		this.patchedMethods = [];
	}
}

import type { App, PluginManifest } from 'obsidian';

interface InternalPluginManager {
	manifests: Record<string, PluginManifest>;
	plugins: Record<string, unknown>;
	enablePluginAndSave(pluginId: string): Promise<void>;
	disablePluginAndSave(pluginId: string): Promise<void>;
}

interface InternalCustomCssManager {
	snippets: string[];
	enabledSnippets: Set<string>;
	setCssEnabledStatus(snippetName: string, enabled: boolean): void;
	requestLoadSnippets(): Promise<void>;
	getSnippetPath(snippetName: string): string;
	getSnippetsFolder(): string;
}

export interface InternalSettingDefinition {
	name?: unknown;
	displayValue?: unknown;
	items?: unknown;
	[key: string]: unknown;
}

export interface InternalSettingTab {
	id: string;
	name?: string;
	containerEl?: HTMLElement;
	settingItems?: InternalSettingDefinition[];
	getElementForDefinition?(definition: InternalSettingDefinition): HTMLElement | null;
}

export interface InternalSettingManager {
	settingTabs: InternalSettingTab[];
	activeTab: InternalSettingTab | null;
	pageStack: unknown[];
	tabContentContainer: HTMLElement;
	open(): void;
	openTabById(pluginId: string): void;
	getCurrentPageEl(): HTMLElement | null;
	refreshCurrentPage(): void;
}

export interface InternalApp extends App {
	plugins: InternalPluginManager;
	customCss: InternalCustomCssManager;
	setting?: InternalSettingManager;
	openWithDefaultApp(path: string): Promise<void> | void;
}

export function asInternalApp(app: App): InternalApp {
	return app as InternalApp;
}

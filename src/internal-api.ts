import { App, PluginManifest } from 'obsidian';

interface InternalPluginManager {
	manifests: Record<string, PluginManifest>;
	plugins: Record<string, unknown>;
	enablePluginAndSave(pluginId: string): Promise<void>;
	disablePluginAndSave(pluginId: string): Promise<void>;
	uninstallPlugin(pluginId: string): Promise<void>;
}

interface InternalCustomCssManager {
	snippets: string[];
	enabledSnippets: Set<string>;
	setCssEnabledStatus(snippetName: string, enabled: boolean): void;
	requestLoadSnippets(): Promise<void>;
	getSnippetPath(snippetName: string): string;
	getSnippetsFolder(): string;
}

interface InternalPluginTab {
	id: string;
}

interface InternalSettingManager {
	pluginTabs: InternalPluginTab[];
	open(): void;
	openTabById(pluginId: string): void;
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
import { Plugin } from 'obsidian';
import { DataStorage } from './data-storage';
import { asInternalApp } from './internal-api';
import { SettingsIntegrationController } from './settings/settings-integration-controller';

export default class PluginsStylesManagerPlugin extends Plugin {
	private dataStorage!: DataStorage;
	private settingsIntegration!: SettingsIntegrationController;
	private initializationPromise: Promise<void> | null = null;
	private unloaded = false;
	private toggleRegistrationScheduled = false;
	private toggleCommandsRegistered = false;
	private readonly cssSnippetCommandIds = new Map<string, string>();

	onload(): void {
		this.dataStorage = new DataStorage(this);
		this.settingsIntegration = new SettingsIntegrationController(
			this.app,
			this.dataStorage,
			() => this.syncCSSSnippetToggleCommands()
		);
		this.register(() => {
			this.unloaded = true;
			this.settingsIntegration.stop();
		});
		this.app.workspace.onLayoutReady(() => {
			void this.runAfterInitialization();
		});

		this.addCommand({
			id: 'open-plugin-manager',
			name: '打开第三方插件管理',
			callback: () => {
				void this.runAfterInitialization(() => {
					this.settingsIntegration.openCommunityPlugins();
				});
			}
		});
		this.addCommand({
			id: 'open-css-snippet-manager',
			name: '打开 CSS 样式代码片段管理',
			callback: () => {
				void this.runAfterInitialization(() => {
					this.settingsIntegration.openCSSSnippets();
				});
			}
		});
	}

	private initialize(): Promise<void> {
		if (this.unloaded) return Promise.resolve();
		if (!this.initializationPromise) {
			this.initializationPromise = this.dataStorage.loadSettings().catch(error => {
				this.initializationPromise = null;
				throw error;
			});
		}
		return this.initializationPromise;
	}

	private async runAfterInitialization(action?: () => void): Promise<void> {
		try {
			await this.initialize();
			if (this.unloaded) return;
			this.settingsIntegration.start();
			this.scheduleToggleCommandRegistration();
			action?.();
		} catch (error) {
			console.error('初始化插件与样式管理器失败:', error);
		}
	}

	private scheduleToggleCommandRegistration(): void {
		if (this.toggleRegistrationScheduled || this.toggleCommandsRegistered) return;
		this.toggleRegistrationScheduled = true;
		const view = this.app.workspace.containerEl.ownerDocument.defaultView ?? window;
		const registerCommands = () => {
			this.toggleRegistrationScheduled = false;
			if (this.unloaded || this.toggleCommandsRegistered) return;
			this.toggleCommandsRegistered = true;
			this.registerPluginToggleCommands();
			this.syncCSSSnippetToggleCommands();
		};

		if (typeof view.requestIdleCallback === 'function') {
			const idleId = view.requestIdleCallback(registerCommands, { timeout: 2000 });
			this.register(() => view.cancelIdleCallback(idleId));
		} else {
			const timeoutId = view.setTimeout(registerCommands, 0);
			this.register(() => view.clearTimeout(timeoutId));
		}
	}

	private registerPluginToggleCommands(): void {
		const allPlugins = asInternalApp(this.app).plugins.manifests;

		for (const [pluginId, plugin] of Object.entries(allPlugins)) {
			this.addCommand({
				id: `toggle-plugin-${pluginId}`,
				name: `切换插件: ${plugin.name}`,
				callback: () => this.togglePlugin(pluginId)
			});
		}
	}

	private syncCSSSnippetToggleCommands(): void {
		if (!this.toggleCommandsRegistered || this.unloaded) return;

		const customCss = asInternalApp(this.app).customCss;
		const snippetNames = new Set(customCss.snippets);

		for (const [snippetName, commandId] of this.cssSnippetCommandIds) {
			if (snippetNames.has(snippetName)) continue;
			this.removeCommand(commandId);
			this.cssSnippetCommandIds.delete(snippetName);
		}

		for (const snippetName of snippetNames) {
			if (this.cssSnippetCommandIds.has(snippetName)) continue;
			const commandId = this.createCSSSnippetCommandId(snippetName);
			this.addCommand({
				id: commandId,
				name: `切换 CSS 片段: ${snippetName}`,
				callback: () => this.toggleCSSSnippet(snippetName)
			});
			this.cssSnippetCommandIds.set(snippetName, commandId);
		}
	}

	private async togglePlugin(pluginId: string): Promise<void> {
		const internalApp = asInternalApp(this.app);
		if (internalApp.plugins.plugins[pluginId]) {
			await internalApp.plugins.disablePluginAndSave(pluginId);
		} else {
			await internalApp.plugins.enablePluginAndSave(pluginId);
		}
	}

	private async toggleCSSSnippet(snippetName: string): Promise<void> {
		const customCss = asInternalApp(this.app).customCss;
		const isEnabled = customCss.enabledSnippets.has(snippetName);
		customCss.setCssEnabledStatus(snippetName, !isEnabled);
		await customCss.requestLoadSnippets();
	}

	private createCSSSnippetCommandId(snippetName: string): string {
		if (/^[a-z0-9]+(?: [a-z0-9]+)*$/i.test(snippetName)) {
			return `toggle-css-snippet-${snippetName.toLowerCase().replace(/ /g, '-')}`;
		}
		const encodedName = Array.from(
			snippetName,
			character => character.codePointAt(0)!.toString(36)
		).join('-');
		return `toggle-css-snippet-encoded-${encodedName}`;
	}
}

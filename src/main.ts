import { Plugin } from 'obsidian';
import { DataStorage } from './data-storage';
import { PluginManagerModal } from './plugin-manager-modal';
import { ManagerSettingTab } from './group-settings';
import { asInternalApp } from './internal-api';

/**
 * Plugins & Styles Manager 主插件类
 */
export default class PluginsStylesManagerPlugin extends Plugin {
	private dataStorage!: DataStorage;

	async onload() {
		// 初始化数据存储
		this.dataStorage = new DataStorage(this);
		await this.dataStorage.loadSettings();

		// 添加左侧功能区图标
		this.addRibbonIcon('package', '打开插件与样式管理器', () => {
			this.openPluginManager();
		});

		// 添加命令：打开插件管理器
		this.addCommand({
			id: 'open-plugin-manager',
			name: '打开插件与样式管理器',
			callback: () => {
				this.openPluginManager();
			}
		});

		// 注册插件和CSS片段的切换命令
		this.registerToggleCommands();

		// 添加设置标签页
		this.addSettingTab(new ManagerSettingTab(this.app, this, this.dataStorage));
	}

	/**
	 * 保存设置
	 */
	async saveSettings(): Promise<void> {
		await this.dataStorage.saveSettings();
	}

	/**
	 * 获取数据存储对象
	 */
	getDataStorage(): DataStorage {
		return this.dataStorage;
	}

	/**
	 * 打开插件管理器
	 */
	private openPluginManager(): void {
		const modal = new PluginManagerModal(this.app, this.dataStorage);
		modal.open();
	}

	/**
	 * 注册所有插件和CSS片段的切换命令
	 */
	private registerToggleCommands(): void {
		this.registerPluginToggleCommands();
		this.registerCSSSnippetToggleCommands();
	}

	/**
	 * 注册所有社区插件的切换命令
	 */
	private registerPluginToggleCommands(): void {
		const allPlugins = asInternalApp(this.app).plugins.manifests;

		Object.entries(allPlugins).forEach(([pluginId, plugin]) => {
			if (!plugin) return;

			this.addCommand({
				id: `toggle-plugin-${pluginId}`,
				name: `切换插件: ${plugin.name}`,
				callback: async () => {
					await this.togglePlugin(pluginId);
				}
			});
		});
	}

	/**
	 * 注册所有CSS片段的切换命令
	 */
	private registerCSSSnippetToggleCommands(): void {
		const customCss = asInternalApp(this.app).customCss;
		const allSnippets = customCss.snippets || [];

		allSnippets.forEach((snippetName: string) => {
			this.addCommand({
				id: `toggle-css-snippet-${this.sanitizeId(snippetName)}`,
				name: `切换CSS片段: ${snippetName}`,
				callback: async () => {
					await this.toggleCSSSnippet(snippetName);
				}
			});
		});
	}

	/**
	 * 切换插件状态
	 */
	private async togglePlugin(pluginId: string): Promise<void> {
		const internalApp = asInternalApp(this.app);
		const plugin = internalApp.plugins.plugins[pluginId];

		if (plugin) {
			await internalApp.plugins.disablePluginAndSave(pluginId);
		} else {
			await internalApp.plugins.enablePluginAndSave(pluginId);
		}
	}

	/**
	 * 切换CSS片段状态
	 */
	private async toggleCSSSnippet(snippetName: string): Promise<void> {
		const customCss = asInternalApp(this.app).customCss;
		const isEnabled = customCss.enabledSnippets.has(snippetName);
		customCss.setCssEnabledStatus(snippetName, !isEnabled);
		await customCss.requestLoadSnippets();
	}

	/**
	 * 清理ID字符串，确保符合命令ID规范
	 */
	private sanitizeId(name: string): string {
		return name.toLowerCase()
			.replace(/\s+/g, '-')
			.replace(/[^a-z0-9-]/g, '')
			.replace(/-+/g, '-');
	}
}


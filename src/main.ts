import { Plugin } from 'obsidian';
import { DataStorage } from './data-storage';
import { PluginManagerModal } from './plugin-manager-modal';
import { ManagerSettingTab } from './group-settings';

/**
 * Plugins & Styles Manager 主插件类
 */
export default class PluginsStylesManagerPlugin extends Plugin {
	private dataStorage: DataStorage;

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
}


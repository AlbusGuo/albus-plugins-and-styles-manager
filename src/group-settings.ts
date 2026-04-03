import { App, PluginSettingTab, Setting, Notice, Modal, SettingGroup } from 'obsidian';
import PluginsStylesManagerPlugin from './main';
import { DataStorage } from './data-storage';
import { asInternalApp } from './internal-api';

/**
 * 分组管理设置标签
 */
export class ManagerSettingTab extends PluginSettingTab {
    plugin: PluginsStylesManagerPlugin;

    icon: string = 'cog';

    private dataStorage: DataStorage;
    private editingGroup: { type: 'plugin' | 'css'; key: string; value: string } | null = null;

    constructor(app: App, plugin: PluginsStylesManagerPlugin, dataStorage: DataStorage) {
        super(app, plugin);
        this.plugin = plugin;
        this.dataStorage = dataStorage;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('obsidianx-settings');
        const contentEl = containerEl.createDiv({ cls: 'obsidianx-settings-content' });
        this.displayManagerTab(contentEl);
    }

    /**
     * 显示管理器标签页（插件分组 + CSS片段分组）
     */
    private displayManagerTab(containerEl: HTMLElement): void {
        // 数据清理
        new Setting(containerEl)
            .setName('清除已卸载的插件数据')
            .setDesc('移除不再安装的插件的备注和分组信息')
            .addButton(btn => {
                btn.setButtonText('清除')
                    .onClick(async () => {
                        const settings = this.dataStorage.getSettings();
                        const allPlugins = asInternalApp(this.app).plugins.manifests;
                        const keysToDelete = Object.keys(settings.metadata).filter(
                            pluginId => !(pluginId in allPlugins)
                        );
                        if (keysToDelete.length > 0) {
                            for (const pluginId of keysToDelete) {
                                delete settings.metadata[pluginId];
                            }
                            await this.dataStorage.saveSettings();
                            new Notice(`已清除 ${keysToDelete.length} 个已卸载插件的数据`);
                        } else {
                            new Notice('没有需要清除的数据');
                        }
                    });
            });

        // 插件分组
        new Setting(containerEl)
            .setName('插件分组')
            .setHeading();
        
        this.displayPluginGroups(containerEl);

        // CSS片段分组
        new Setting(containerEl)
            .setName('CSS 片段分组')
            .setHeading();
        
        this.displayCSSGroups(containerEl);
    }

    /**
     * 显示插件分组
     */
    private displayPluginGroups(containerEl: HTMLElement): void {
        const groupContainer = containerEl.createDiv();
        const settingGroup = new SettingGroup(groupContainer);

        const groups = this.dataStorage.getSettings().groups;
        const editableGroups = Object.keys(groups).filter(key => key !== 'all' && key !== 'other');

        // 分组列表
        if (editableGroups.length === 0) {
            settingGroup.addSetting((setting) => {
                setting
                    .setName('暂无自定义分组')
                    .setClass('obsidianx-empty-message');
            });
        } else {
            editableGroups.forEach(groupKey => {
                const groupName = groups[groupKey] || '';
                const isEditing = this.editingGroup?.type === 'plugin' && this.editingGroup?.key === groupKey;
                
                settingGroup.addSetting((setting) => {
                    setting
                        .addColorPicker((picker) => {
                            const currentColor = this.dataStorage.getGroupColor(groupKey);
                            picker.setValue(currentColor || '#7f6df2');
                            picker.onChange(async (value) => {
                                await this.dataStorage.saveGroupColor(groupKey, value);
                            });
                        })
                        .addExtraButton((button) => {
                            button
                                .setIcon('rotate-ccw')
                                .setTooltip('重置为默认颜色')
                                .onClick(async () => {
                                    await this.dataStorage.saveGroupColor(groupKey, '');
                                    this.display();
                                });
                        })
                        .addExtraButton((button) => {
                            button
                                .setIcon('trash-2')
                                .setTooltip('删除分组')
                                .onClick(async () => {
                                    await this.deleteGroup(groupKey, 'plugin');
                                });
                        });

                    if (isEditing) {
                        // 编辑模式：使用 Obsidian 原生输入框，移至 nameEl 保持左侧定位
                        setting.setName('');
                        setting.addText((text) => {
                            text.setValue(this.editingGroup!.value)
                                .setPlaceholder('分组名称')
                                .onChange((value) => {
                                    if (this.editingGroup) {
                                        this.editingGroup.value = value;
                                    }
                                });

                            // 将输入框从 controlEl 移至 nameEl，保持原生样式但定位在左侧
                            setting.nameEl.appendChild(text.inputEl);
                            text.inputEl.style.width = '100%';

                            text.inputEl.addEventListener('keydown', (e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    this.saveEdit(groupKey, 'plugin');
                                } else if (e.key === 'Escape') {
                                    this.cancelEdit();
                                }
                            });

                            text.inputEl.addEventListener('blur', () => {
                                this.saveEdit(groupKey, 'plugin');
                            });

                            setTimeout(() => {
                                text.inputEl.focus();
                                text.inputEl.select();
                            }, 0);
                        });
                    } else {
                        // 显示模式
                        setting.setName(groupName);
                        setting.nameEl.addClass('obsidianx-clickable');
                        setting.nameEl.addEventListener('click', () => {
                            this.editingGroup = { type: 'plugin', key: groupKey, value: groupName };
                            this.display();
                        });
                    }
                });
            });
        }

        // 添加按钮
        settingGroup.addSetting((addSetting) => {
            addSetting.settingEl.addClass('albus-obsidianx-item-add-setting');
            addSetting.controlEl.addClass('albus-obsidianx-item-add-container');
            addSetting.addButton((button) => {
                button
                    .setButtonText('添加插件分组')
                    .setClass('albus-obsidianx-item-add-btn')
                    .onClick(() => {
                        this.showAddGroupDialog('plugin');
                    });
            });
        });
    }

    /**
     * 显示CSS片段分组
     */
    private displayCSSGroups(containerEl: HTMLElement): void {
        const groupContainer = containerEl.createDiv();
        const settingGroup = new SettingGroup(groupContainer);

        const groups = this.dataStorage.getSettings().cssGroups;
        const editableGroups = Object.keys(groups).filter(key => key !== 'all' && key !== 'other');

        // 分组列表
        if (editableGroups.length === 0) {
            settingGroup.addSetting((setting) => {
                setting
                    .setName('暂无自定义分组')
                    .setClass('obsidianx-empty-message');
            });
        } else {
            editableGroups.forEach(groupKey => {
                const groupName = groups[groupKey] || '';
                const isEditing = this.editingGroup?.type === 'css' && this.editingGroup?.key === groupKey;
                
                settingGroup.addSetting((setting) => {
                    setting
                        .addColorPicker((picker) => {
                            const currentColor = this.dataStorage.getCSSGroupColor(groupKey);
                            picker.setValue(currentColor || '#7f6df2');
                            picker.onChange(async (value) => {
                                await this.dataStorage.saveCSSGroupColor(groupKey, value);
                            });
                        })
                        .addExtraButton((button) => {
                            button
                                .setIcon('rotate-ccw')
                                .setTooltip('重置为默认颜色')
                                .onClick(async () => {
                                    await this.dataStorage.saveCSSGroupColor(groupKey, '');
                                    this.display();
                                });
                        })
                        .addExtraButton((button) => {
                            button
                                .setIcon('trash-2')
                                .setTooltip('删除分组')
                                .onClick(async () => {
                                    await this.deleteGroup(groupKey, 'css');
                                });
                        });

                    if (isEditing) {
                        // 编辑模式：使用 Obsidian 原生输入框，移至 nameEl 保持左侧定位
                        setting.setName('');
                        setting.addText((text) => {
                            text.setValue(this.editingGroup!.value)
                                .setPlaceholder('分组名称')
                                .onChange((value) => {
                                    if (this.editingGroup) {
                                        this.editingGroup.value = value;
                                    }
                                });

                            // 将输入框从 controlEl 移至 nameEl，保持原生样式但定位在左侧
                            setting.nameEl.appendChild(text.inputEl);
                            text.inputEl.style.width = '100%';

                            text.inputEl.addEventListener('keydown', (e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    this.saveEdit(groupKey, 'css');
                                } else if (e.key === 'Escape') {
                                    this.cancelEdit();
                                }
                            });

                            text.inputEl.addEventListener('blur', () => {
                                this.saveEdit(groupKey, 'css');
                            });

                            setTimeout(() => {
                                text.inputEl.focus();
                                text.inputEl.select();
                            }, 0);
                        });
                    } else {
                        // 显示模式
                        setting.setName(groupName);
                        setting.nameEl.addClass('obsidianx-clickable');
                        setting.nameEl.addEventListener('click', () => {
                            this.editingGroup = { type: 'css', key: groupKey, value: groupName };
                            this.display();
                        });
                    }
                });
            });
        }

        // 添加按钮
        settingGroup.addSetting((addSetting) => {
            addSetting.settingEl.addClass('albus-obsidianx-item-add-setting');
            addSetting.controlEl.addClass('albus-obsidianx-item-add-container');
            addSetting.addButton((button) => {
                button
                    .setButtonText('添加 CSS 分组')
                    .setClass('albus-obsidianx-item-add-btn')
                    .onClick(() => {
                        this.showAddGroupDialog('css');
                    });
            });
        });
    }

    /**
     * 保存编辑
     */
    private async saveEdit(groupKey: string, type: 'plugin' | 'css'): Promise<void> {
        if (!this.editingGroup) return;
        
        const newName = this.editingGroup.value.trim();
        if (!newName) {
            new Notice('分组名称不能为空');
            this.cancelEdit();
            return;
        }

        const groups = type === 'plugin'
            ? this.dataStorage.getSettings().groups
            : this.dataStorage.getSettings().cssGroups;
        const oldName = groups[groupKey] || '';
        
        if (newName !== oldName) {
            await this.updateGroupName(groupKey, newName, type);
        }
        
        this.editingGroup = null;
        this.display();
    }

    /**
     * 取消编辑
     */
    private cancelEdit(): void {
        this.editingGroup = null;
        this.display();
    }

    /**
     * 显示添加分组对话框
     */
    private showAddGroupDialog(type: 'plugin' | 'css'): void {
        const modal = new AddGroupModal(this.app, type, async (groupName) => {
            await this.addGroup(groupName, type);
        });
        modal.open();
    }

    /**
     * 添加分组
     */
    private async addGroup(groupName: string, type: 'plugin' | 'css'): Promise<void> {
        if (!groupName.trim()) {
            new Notice('请输入分组名称');
            return;
        }

        const groupKey = groupName.toLowerCase().replace(/\s+/g, '_');
        const groups = type === 'plugin' 
            ? this.dataStorage.getSettings().groups 
            : this.dataStorage.getSettings().cssGroups;

        if (groups[groupKey]) {
            new Notice('分组已存在');
            return;
        }

        const updatedGroups = { ...groups, [groupKey]: groupName.trim() };

        if (type === 'plugin') {
            await this.dataStorage.updateGroups(updatedGroups);
        } else {
            await this.dataStorage.updateCSSGroups(updatedGroups);
        }
        
        new Notice(`已添加分组"${groupName}"`);
        this.display();
    }

    /**
     * 更新分组名称
     */
    private async updateGroupName(groupKey: string, newName: string, type: 'plugin' | 'css'): Promise<void> {
        const groups = type === 'plugin' 
            ? this.dataStorage.getSettings().groups 
            : this.dataStorage.getSettings().cssGroups;
        
        const updatedGroups = { ...groups, [groupKey]: newName };

        if (type === 'plugin') {
            await this.dataStorage.updateGroups(updatedGroups);
        } else {
            await this.dataStorage.updateCSSGroups(updatedGroups);
        }
        
        new Notice('分组名称已更新');
    }

    /**
     * 删除分组
     */
    private async deleteGroup(groupKey: string, type: 'plugin' | 'css'): Promise<void> {
        const settings = this.dataStorage.getSettings();
        const groups = type === 'plugin' ? settings.groups : settings.cssGroups;
        const updatedGroups = { ...groups };
        delete updatedGroups[groupKey];

        if (type === 'plugin') {
            await this.dataStorage.updateGroups(updatedGroups);
            
            // 将该分组的插件移动到"其他"分组
            const metadata = settings.metadata;
            for (const pluginId in metadata) {
                if (metadata[pluginId]?.group === groupKey) {
                    metadata[pluginId].group = 'other';
                }
            }
        } else {
            await this.dataStorage.updateCSSGroups(updatedGroups);
            
            // 将该分组的CSS片段移动到"其他"分组
            const cssSnippetMetadata = settings.cssSnippetMetadata;
            for (const snippetName in cssSnippetMetadata) {
                if (cssSnippetMetadata[snippetName]?.group === groupKey) {
                    cssSnippetMetadata[snippetName].group = 'other';
                }
            }
        }

        await this.dataStorage.saveSettings();
        new Notice('已删除分组');
        this.display();
    }

}

/**
 * 添加分组对话框
 */
class AddGroupModal extends Modal {
    private type: 'plugin' | 'css';
    private onSubmit: (groupName: string) => void;

    constructor(app: App, type: 'plugin' | 'css', onSubmit: (groupName: string) => void) {
        super(app);
        this.type = type;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        this.titleEl.setText(this.type === 'plugin' ? '添加插件分组' : '添加 CSS 片段分组');

        const inputContainer = contentEl.createDiv();
        const input = inputContainer.createEl('input', {
            type: 'text',
            placeholder: '输入分组名称',
            cls: 'obsidianx-modal-input'
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.submit(input.value);
            } else if (e.key === 'Escape') {
                this.close();
            }
        });

        const buttonContainer = contentEl.createDiv('obsidianx-modal-buttons');

        const cancelBtn = buttonContainer.createEl('button', { text: '取消' });
        cancelBtn.addEventListener('click', () => this.close());

        const submitBtn = buttonContainer.createEl('button', { text: '添加', cls: 'mod-cta' });
        submitBtn.addEventListener('click', () => this.submit(input.value));

        setTimeout(() => input.focus(), 10);
    }

    private submit(value: string) {
        if (value.trim()) {
            this.onSubmit(value.trim());
            this.close();
        } else {
            new Notice('请输入分组名称');
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

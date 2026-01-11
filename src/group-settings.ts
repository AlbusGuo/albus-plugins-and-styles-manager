import { App, PluginSettingTab, Setting, Notice, Modal, ButtonComponent, setIcon, SettingGroup } from 'obsidian';
import ObsidianXPlugin from './main';
import { DataStorage } from './data-storage';

/**
 * 分组管理设置标签
 */
export class GroupManagementSettingTab extends PluginSettingTab {
    plugin: ObsidianXPlugin;

    icon: string = 'cog';

    private dataStorage: DataStorage;
    private editingGroup: { type: 'plugin' | 'css'; key: string; value: string } | null = null;

    constructor(app: App, plugin: ObsidianXPlugin, dataStorage: DataStorage) {
        super(app, plugin);
        this.plugin = plugin;
        this.dataStorage = dataStorage;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

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
                    if (isEditing) {
                        // 编辑模式
                        setting.addText((text) => {
                            text
                                .setValue(this.editingGroup!.value)
                                .onChange((value) => {
                                    if (this.editingGroup) {
                                        this.editingGroup.value = value;
                                    }
                                });
                            
                            // 自动聚焦
                            setTimeout(() => {
                                text.inputEl.focus();
                                text.inputEl.select();
                            }, 0);
                            
                            // 键盘事件
                            text.inputEl.addEventListener('keydown', (e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    this.saveEdit(groupKey, 'plugin');
                                } else if (e.key === 'Escape') {
                                    this.cancelEdit();
                                }
                            });
                            
                            // 失去焦点时保存
                            text.inputEl.addEventListener('blur', () => {
                                this.saveEdit(groupKey, 'plugin');
                            });
                        });
                    } else {
                        // 显示模式
                        setting
                            .setName(groupName)
                            .addExtraButton((button) => {
                                button
                                    .setIcon('trash-2')
                                    .setTooltip('删除分组')
                                    .onClick(async () => {
                                        await this.deleteGroup(groupKey, 'plugin');
                                    });
                            });
                        
                        // 点击名称进入编辑
                        setting.nameEl.style.cursor = 'pointer';
                        setting.nameEl.addEventListener('click', () => {
                            this.editingGroup = { type: 'plugin', key: groupKey, value: groupName };
                            this.display();
                        });
                    }
                });
            });
        }

        // 添加按钮
        settingGroup.addSetting((setting) => {
            setting.addButton((button: ButtonComponent) => {
                button
                    .setButtonText('添加插件分组')
                    .setCta()
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
                    if (isEditing) {
                        // 编辑模式
                        setting.addText((text) => {
                            text
                                .setValue(this.editingGroup!.value)
                                .onChange((value) => {
                                    if (this.editingGroup) {
                                        this.editingGroup.value = value;
                                    }
                                });
                            
                            // 自动聚焦
                            setTimeout(() => {
                                text.inputEl.focus();
                                text.inputEl.select();
                            }, 0);
                            
                            // 键盘事件
                            text.inputEl.addEventListener('keydown', (e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    this.saveEdit(groupKey, 'css');
                                } else if (e.key === 'Escape') {
                                    this.cancelEdit();
                                }
                            });
                            
                            // 失去焦点时保存
                            text.inputEl.addEventListener('blur', () => {
                                this.saveEdit(groupKey, 'css');
                            });
                        });
                    } else {
                        // 显示模式
                        setting
                            .setName(groupName)
                            .addExtraButton((button) => {
                                button
                                    .setIcon('trash-2')
                                    .setTooltip('删除分组')
                                    .onClick(async () => {
                                        await this.deleteGroup(groupKey, 'css');
                                    });
                            });
                        
                        // 点击名称进入编辑
                        setting.nameEl.style.cursor = 'pointer';
                        setting.nameEl.addEventListener('click', () => {
                            this.editingGroup = { type: 'css', key: groupKey, value: groupName };
                            this.display();
                        });
                    }
                });
            });
        }

        // 添加按钮
        settingGroup.addSetting((setting) => {
            setting.addButton((button: ButtonComponent) => {
                button
                    .setButtonText('添加 CSS 分组')
                    .setCta()
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
        
        if (newName !== this.editingGroup.value) {
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
        
        contentEl.createEl('h2', { text: this.type === 'plugin' ? '添加插件分组' : '添加CSS片段分组' });

        const inputContainer = contentEl.createDiv();
        const input = inputContainer.createEl('input', {
            type: 'text',
            placeholder: '输入分组名称',
            cls: 'albus-obsidianx-modal-input'
        });
        input.style.width = '100%';
        input.style.padding = '8px';
        input.style.marginTop = '12px';
        input.style.marginBottom = '16px';

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.submit(input.value);
            } else if (e.key === 'Escape') {
                this.close();
            }
        });

        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'flex-end';
        buttonContainer.style.gap = '8px';

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

import { App, PluginSettingTab, Setting, Notice, Modal, ButtonComponent, SettingGroup } from 'obsidian';
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
        containerEl.addClass('obsidianx-settings');

        // 标签页导航
        const tabNames = ['manager', 'opener'];
        const tabLabels: Record<string, string> = {
            'manager': '管理器',
            'opener': '文件打开方式'
        };

        const tabsEl = containerEl.createDiv({ cls: 'obsidianx-settings-tabs' });

        for (const tabName of tabNames) {
            const tab = tabsEl.createDiv({
                cls: 'obsidianx-settings-tab'
                    + (this.dataStorage.getSettings().settingsTab === tabName ? ' is-active' : '')
            });
            tab.setText(tabLabels[tabName] ?? tabName);
            tab.addEventListener('click', () => {
                this.dataStorage.getSettings().settingsTab = tabName;
                this.plugin.saveSettings();
                this.display();
            });
        }

        // 内容容器
        const contentEl = containerEl.createDiv({ cls: 'obsidianx-settings-content' });

        if (this.dataStorage.getSettings().settingsTab === 'manager') {
            this.displayManagerTab(contentEl);
        } else if (this.dataStorage.getSettings().settingsTab === 'opener') {
            this.displayOpenerSettings(contentEl);
        }
    }

    /**
     * 显示管理器标签页（插件分组 + CSS片段分组）
     */
    private displayManagerTab(containerEl: HTMLElement): void {
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
                        // 编辑模式：在nameEl中放置输入框
                        setting.nameEl.empty();
                        const input = setting.nameEl.createEl('input', {
                            type: 'text',
                            value: this.editingGroup!.value,
                            cls: 'obsidianx-inline-rename-input'
                        });
                        
                        input.addEventListener('input', (e) => {
                            if (this.editingGroup) {
                                this.editingGroup.value = (e.target as HTMLInputElement).value;
                            }
                        });
                        
                        input.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                this.saveEdit(groupKey, 'plugin');
                            } else if (e.key === 'Escape') {
                                this.cancelEdit();
                            }
                        });
                        
                        input.addEventListener('blur', () => {
                            this.saveEdit(groupKey, 'plugin');
                        });

                        setTimeout(() => {
                            input.focus();
                            input.select();
                        }, 0);
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
                        // 编辑模式：在nameEl中放置输入框
                        setting.nameEl.empty();
                        const input = setting.nameEl.createEl('input', {
                            type: 'text',
                            value: this.editingGroup!.value,
                            cls: 'obsidianx-inline-rename-input'
                        });
                        
                        input.addEventListener('input', (e) => {
                            if (this.editingGroup) {
                                this.editingGroup.value = (e.target as HTMLInputElement).value;
                            }
                        });
                        
                        input.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                this.saveEdit(groupKey, 'css');
                            } else if (e.key === 'Escape') {
                                this.cancelEdit();
                            }
                        });
                        
                        input.addEventListener('blur', () => {
                            this.saveEdit(groupKey, 'css');
                        });

                        setTimeout(() => {
                            input.focus();
                            input.select();
                        }, 0);
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

    /**
     * 显示 Opener 设置
     */
    private displayOpenerSettings(containerEl: HTMLElement): void {
        const openerContainer = containerEl.createDiv();
        const settingGroup = new SettingGroup(openerContainer);

        const settings = this.dataStorage.getSettings();
        const openerSettings = settings.opener;

        // 新标签页设置
        settingGroup.addSetting((setting) => {
            setting
                .setName('默认在新标签页打开')
                .setDesc('启用后, 新文件将在新标签页打开, 如果文件之前已打开, 则切换到已存在的标签页. 禁用则使用 Obsidian 默认行为.')
                .addToggle((toggle) => {
                    toggle.setValue(openerSettings.newTab).onChange(async (value) => {
                        settings.opener.newTab = value;
                        await this.plugin.saveSettings();
                    });
                });
        });

        // PDF 外部应用设置
        settingGroup.addSetting((setting) => {
            setting
                .setName('PDF 使用系统默认应用')
                .setDesc('启用后, PDF 文件将使用系统默认应用打开.禁用则在 Obsidian 中打开.')
                .addToggle((toggle) => {
                    toggle.setValue(openerSettings.PDFApp).onChange(async (value) => {
                        settings.opener.PDFApp = value;
                        await this.plugin.saveSettings();
                    });
                });
        });

        // 仅按键时使用外部应用
        settingGroup.addSetting((setting) => {
            setting
                .setName('仅按住 Ctrl/Cmd 键时使用外部应用')
                .setDesc('启用后, 仅在按住 Ctrl/Cmd 键时使用系统默认应用打开. 禁用则总是使用系统默认应用.')
                .addToggle((toggle) => {
                    toggle.setValue(openerSettings.extOnlyWhenMetaKey).onChange(async (value) => {
                        settings.opener.extOnlyWhenMetaKey = value;
                        await this.plugin.saveSettings();
                    });
                });
        });

        // 所有媒体文件使用外部应用
        settingGroup.addSetting((setting) => {
            setting
                .setName('所有媒体文件使用外部应用打开')
                .setDesc('启用后, 所有 Obsidian 支持的媒体文件都将使用系统默认应用打开. 禁用则在 Obsidian 中打开. 默认支持的扩展名包括: png、webp、jpg、jpeg、gif、bmp、svg、mp3、webm、wav、m4a、ogg、3gp、flac、mp4、ogv、mov、mkv.')
                .addToggle((toggle) => {
                    toggle.setValue(openerSettings.allExt).onChange(async (value) => {
                        settings.opener.allExt = value;
                        await this.plugin.saveSettings();
                    });
                });
        });

        // 自定义扩展名列表
        settingGroup.addSetting((setting) => {
            setting
                .setName('启用自定义扩展名列表')
                .setDesc('手动添加需要新标签页打开的自定义扩展名.')
                .addToggle((toggle) => {
                    toggle.setValue(openerSettings.custExt).onChange(async (value) => {
                        settings.opener.custExt = value;
                        await this.plugin.saveSettings();
                        this.display(); // 重新渲染以显示/隐藏文本框
                    });
                });
        });

        // 自定义扩展名输入框
        if (openerSettings.custExt) {
            settingGroup.addSetting((setting) => {
                setting
                    .setName('自定义扩展名列表')
                    .setDesc('输入扩展名, 不需要点, 如 docx. 每行一个.')
                    .addTextArea((textArea) => {
                        textArea.inputEl.rows = 5;
                        textArea
                            .setValue(openerSettings.custExtList.join('\n'))
                            .onChange(async (value) => {
                                settings.opener.custExtList = value.split('\n').filter(line => line.trim());
                                await this.plugin.saveSettings();
                            });
                    });
                setting.settingEl.addClass('obsidianx-no-border-top');
            });
        }
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

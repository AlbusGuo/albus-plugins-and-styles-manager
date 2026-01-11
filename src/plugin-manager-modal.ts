import { App, Modal, Notice, setIcon, PluginManifest, ToggleComponent } from 'obsidian';
import { DataStorage } from './data-storage';
import { PluginInfo, CSSSnippetInfo, FilterType } from './types';
import { filterPlugins, sortPlugins, formatDate } from './utils';

/**
 * 插件管理器模态框
 */
export class PluginManagerModal extends Modal {
    private dataStorage: DataStorage;
    private searchTerm: string = '';
    private filterEnabled: FilterType = 'all';
    private selectedGroup: string = 'plugin-all';
    private editingRemark: { pluginId: string; value: string } | null = null;
    private editingDescription: { snippetName: string; value: string } | null = null;
    private renamingSnippet: { name: string; newName: string } | null = null;
    private showGroupDropdown: string | null = null;

    private pluginListEl: HTMLElement;
    private statsEl: HTMLElement;

    constructor(app: App, dataStorage: DataStorage) {
        super(app);
        this.dataStorage = dataStorage;
    }

    onOpen() {
        const { contentEl, containerEl } = this;
        containerEl.addClass('albus-obsidianx-plugin-manager-modal');
        
        this.buildUI();
        this.refresh();

        // 点击外部关闭下拉框
        document.addEventListener('mousedown', this.handleClickOutside);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        document.removeEventListener('mousedown', this.handleClickOutside);
    }

    /**
     * 构建UI
     */
    private buildUI(): void {
        const { contentEl } = this;
        contentEl.empty();

        // 创建容器
        const container = contentEl.createDiv('albus-obsidianx-container');

        // 创建左侧边栏
        const sidebar = container.createDiv('albus-obsidianx-sidebar');
        this.buildSidebar(sidebar);

        // 创建右侧主内容区
        const mainContent = container.createDiv('albus-obsidianx-main-content');

        // 创建固定头部
        const header = mainContent.createDiv('albus-obsidianx-fixed-header');
        this.statsEl = this.buildToolbar(header);

        // 创建可滚动列表
        const scrollableList = mainContent.createDiv('albus-obsidianx-scrollable-list');
        this.pluginListEl = scrollableList.createDiv('albus-obsidianx-plugin-list');
    }

    /**
     * 构建左侧边栏
     */
    private buildSidebar(parent: HTMLElement): void {
        const settings = this.dataStorage.getSettings();
        
        // 获取所有数据
        const allPlugins = this.getPluginData();
        const allSnippets = this.getCSSSnippetData();
        
        // 插件分组区域
        const pluginTitle = parent.createDiv('albus-obsidianx-sidebar-title');
        pluginTitle.textContent = '第三方插件';
        
        const pluginGroupList = parent.createDiv('albus-obsidianx-sidebar-list');
        const groups = settings.groups;
        
        // 排序：先显示all，然后其他自定义分组，最后other
        const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
            if (a === 'all') return -1;
            if (b === 'all') return 1;
            if (a === 'other') return 1;
            if (b === 'other') return -1;
            return 0;
        });
        
        sortedGroupKeys.forEach(groupKey => {
            const pluginGroupKey = 'plugin-' + groupKey;
            const groupItem = pluginGroupList.createDiv('albus-obsidianx-sidebar-item');
            if (this.selectedGroup === pluginGroupKey) {
                groupItem.addClass('active');
            }
            
            // 分组名称
            const nameEl = groupItem.createDiv('albus-obsidianx-sidebar-item-name');
            nameEl.textContent = groups[groupKey] || '';
            
            // 计算统计数据
            const actualGroupKey = groupKey;
            const filteredPlugins = allPlugins.filter(p => {
                // 搜索过滤
                const lowerSearchTerm = this.searchTerm.toLowerCase();
                const matchesSearch = lowerSearchTerm === '' ||
                    p.name.toLowerCase().includes(lowerSearchTerm) ||
                    (p.author && p.author.toLowerCase().includes(lowerSearchTerm)) ||
                    p.description.toLowerCase().includes(lowerSearchTerm) ||
                    p.remark.toLowerCase().includes(lowerSearchTerm);
                
                // 分组过滤
                const matchesGroup = actualGroupKey === 'all' || p.group === actualGroupKey;
                
                return matchesSearch && matchesGroup;
            });
            
            const enabledCount = filteredPlugins.filter(p => p.enabled).length;
            const totalCount = filteredPlugins.length;
            
            // 显示统计
            const countEl = groupItem.createDiv('albus-obsidianx-sidebar-item-count');
            countEl.textContent = `${enabledCount}/${totalCount}`;
            
            groupItem.addEventListener('click', () => {
                this.selectedGroup = pluginGroupKey;
                this.refresh();
            });
        });
        
        // CSS片段分组区域
        const cssTitle = parent.createDiv('albus-obsidianx-sidebar-title');
        cssTitle.textContent = 'CSS 代码片段';
        
        const cssGroupList = parent.createDiv('albus-obsidianx-sidebar-list');
        const cssGroups = settings.cssGroups;
        
        // 排序：先显示all，然后其他自定义分组，最后other
        const sortedCssGroupKeys = Object.keys(cssGroups).sort((a, b) => {
            if (a === 'all') return -1;
            if (b === 'all') return 1;
            if (a === 'other') return 1;
            if (b === 'other') return -1;
            return 0;
        });
        
        sortedCssGroupKeys.forEach(groupKey => {
            const cssGroupKey = 'css-' + groupKey;
            const groupItem = cssGroupList.createDiv('albus-obsidianx-sidebar-item');
            if (this.selectedGroup === cssGroupKey) {
                groupItem.addClass('active');
            }
            
            // 分组名称
            const nameEl = groupItem.createDiv('albus-obsidianx-sidebar-item-name');
            nameEl.textContent = cssGroups[groupKey] || '';
            
            // 计算统计数据
            const actualGroupKey = groupKey;
            const filteredSnippets = allSnippets.filter(s => {
                // 搜索过滤
                const lowerSearchTerm = this.searchTerm.toLowerCase();
                const matchesSearch = lowerSearchTerm === '' ||
                    s.name.toLowerCase().includes(lowerSearchTerm) ||
                    s.description.toLowerCase().includes(lowerSearchTerm);
                
                // 分组过滤
                const matchesGroup = actualGroupKey === 'all' || s.group === actualGroupKey;
                
                return matchesSearch && matchesGroup;
            });
            
            const enabledCount = filteredSnippets.filter(s => s.enabled).length;
            const totalCount = filteredSnippets.length;
            
            // 显示统计
            const countEl = groupItem.createDiv('albus-obsidianx-sidebar-item-count');
            countEl.textContent = `${enabledCount}/${totalCount}`;
            
            groupItem.addEventListener('click', () => {
                this.selectedGroup = cssGroupKey;
                this.refresh();
            });
        });
    }

    /**
     * 构建工具栏
     */
    private buildToolbar(parent: HTMLElement): HTMLElement {
        const toolbar = parent.createDiv('albus-obsidianx-toolbar');
        const isCSSGroup = this.selectedGroup.startsWith('css-');
        
        // 搜索框 + 小球按钮 + 新建按钮（同一行）
        const searchRow = toolbar.createDiv('albus-obsidianx-toolbar-row');
        
        const searchWrapper = searchRow.createDiv('albus-obsidianx-search-wrapper');
        const searchInput = searchWrapper.createEl('input', {
            type: 'text',
            placeholder: isCSSGroup ? '搜索CSS片段名称或描述...' : '搜索插件名称、作者或描述...',
            cls: 'albus-obsidianx-search-input'
        });
        searchInput.value = this.searchTerm;
        searchInput.addEventListener('input', (e) => {
            this.searchTerm = (e.target as HTMLInputElement).value;
            // 只更新列表和统计，不重建工具栏
            this.updateStats();
            this.updatePluginList();
        });
        
        // 状态筛选三段式按钮（在搜索框右侧）
        const statusBallContainer = searchRow.createDiv('albus-obsidianx-status-dropdown');
        this.buildStatusDropdown(statusBallContainer);
        
        // CSS片段分组时显示"新建片段"按钮
        if (isCSSGroup) {
            const createButton = searchRow.createEl('button', {
                cls: 'albus-obsidianx-settings-button',
                attr: { 'aria-label': '新建片段' }
            });
            setIcon(createButton, 'square-plus');
            createButton.addEventListener('click', () => {
                this.showCreateSnippetDialog();
            });
        }

        // 第二行：统计信息
        const statsRow = toolbar.createDiv('albus-obsidianx-toolbar-stats-row');
        const statsEl = statsRow.createDiv('albus-obsidianx-stats-info');
        
        return statsEl;
    }

    /**
     * 构建状态筛选开关
     */
    private buildStatusDropdown(container: HTMLElement): void {
        container.empty();
        
        const button = container.createEl('button', { cls: 'albus-obsidianx-settings-button' });
        
        // 根据当前状态设置图标和提示文本
        const icons = {
            'all': 'circle',
            'enabled': 'circle-check',
            'disabled': 'circle-x'
        };
        const tooltips = {
            'all': '全部',
            'enabled': '已启用',
            'disabled': '未启用'
        };
        
        setIcon(button, icons[this.filterEnabled]);
        button.setAttribute('aria-label', tooltips[this.filterEnabled]);
        
        button.addEventListener('click', () => {
            // 循环切换状态
            if (this.filterEnabled === 'all') {
                this.filterEnabled = 'enabled';
            } else if (this.filterEnabled === 'enabled') {
                this.filterEnabled = 'disabled';
            } else {
                this.filterEnabled = 'all';
            }
            this.refresh();
        });
    }

    /**
     * 获取插件数据
     */
    private getPluginData(): PluginInfo[] {
        // @ts-ignore - Obsidian内部API
        const plugins = this.app.plugins.plugins;
        // @ts-ignore - Obsidian内部API
        const allPlugins = this.app.plugins.manifests;

        return Object.keys(allPlugins).map((pluginId) => {
            const enabled = !!plugins[pluginId];
            const plugin = allPlugins[pluginId];
            const metadata = this.dataStorage.getPluginMetadata(pluginId);
            
            return {
                id: pluginId,
                name: plugin.name,
                version: plugin.version,
                author: (plugin.author && plugin.author.trim()) || '未知作者',
                description: plugin.description || '',
                isDesktopOnly: plugin.isDesktopOnly || false,
                enabled: enabled,
                remark: metadata.remark,
                group: metadata.group,
                lastModified: metadata.lastModified
            };
        });
    }

    /**
     * 获取CSS片段数据
     */
    private getCSSSnippetData(): CSSSnippetInfo[] {
        // @ts-ignore - Obsidian内部API
        const customCss = this.app.customCss;
        const allSnippets = customCss.snippets || [];
        
        return allSnippets.map((snippetName: string) => {
            const enabled = customCss.enabledSnippets.has(snippetName);
            const metadata = this.dataStorage.getCSSSnippetMetadata(snippetName);
            
            return {
                name: snippetName,
                enabled: enabled,
                path: customCss.getSnippetPath(snippetName),
                description: metadata.description || '',
                group: metadata.group || 'other'
            };
        });
    }

    /**
     * 刷新界面
     */
    private refresh(): void {
        // 保存当前滚动位置
        const scrollableList = this.contentEl.querySelector('.albus-obsidianx-scrollable-list') as HTMLElement;
        const scrollTop = scrollableList ? scrollableList.scrollTop : 0;
        
        // 保持搜索框的值
        const searchInput = this.contentEl.querySelector('.albus-obsidianx-search-input') as HTMLInputElement;
        if (searchInput) {
            searchInput.value = this.searchTerm;
        }
        
        // 重新构建左侧边栏
        const sidebar = this.contentEl.querySelector('.albus-obsidianx-sidebar') as HTMLElement;
        if (sidebar) {
            sidebar.empty();
            this.buildSidebar(sidebar);
        }
        
        // 重新构建工具栏（包括状态筛选和新建按钮）
        const toolbar = this.contentEl.querySelector('.albus-obsidianx-toolbar') as HTMLElement;
        if (toolbar) {
            const parent = toolbar.parentElement;
            if (parent) {
                toolbar.remove();
                this.statsEl = this.buildToolbar(parent);
            }
        }

        // 刷新统计信息
        this.updateStats();

        // 刷新插件列表
        this.updatePluginList();
        
        // 恢复滚动位置
        if (scrollableList) {
            scrollableList.scrollTop = scrollTop;
        }
    }

    /**
     * 更新统计信息
     */
    private updateStats(): void {
        // 统计信息已移动到侧边栏分组项，此处不再显示
        if (!this.statsEl) return;
        this.statsEl.empty();
    }

    /**
     * 更新侧边栏统计数量
     */
    private updateSidebarStats(): void {
        // 直接重建侧边栏以确保统计数量正确更新
        const sidebar = this.contentEl.querySelector('.albus-obsidianx-sidebar') as HTMLElement;
        if (sidebar) {
            sidebar.empty();
            this.buildSidebar(sidebar);
        }
    }

    /**
     * 过滤CSS片段
     */
    private filterCSSSnippets(snippets: CSSSnippetInfo[]): CSSSnippetInfo[] {
        return snippets.filter(snippet => {
            const lowerSearchTerm = this.searchTerm.toLowerCase();
            const matchesSearch = lowerSearchTerm === "" ||
                snippet.name.toLowerCase().includes(lowerSearchTerm) ||
                snippet.description.toLowerCase().includes(lowerSearchTerm);

            const matchesStatus = this.filterEnabled === "all" ||
                (this.filterEnabled === "enabled" && snippet.enabled) ||
                (this.filterEnabled === "disabled" && !snippet.enabled);

            // 提取实际的分组key（移除'css-'前缀）
            const actualGroup = this.selectedGroup.replace('css-', '');
            const matchesGroup = actualGroup === "all" || snippet.group === actualGroup;

            return matchesSearch && matchesStatus && matchesGroup;
        });
    }

    /**
     * 更新插件列表
     */
    private updatePluginList(): void {
        if (!this.pluginListEl) return;

        // 保存当前滚动位置
        const scrollableList = this.pluginListEl.closest('.albus-obsidianx-scrollable-list') as HTMLElement;
        const scrollTop = scrollableList ? scrollableList.scrollTop : 0;

        this.pluginListEl.empty();

        // 根据selectedGroup判断显示CSS片段还是插件
        if (this.selectedGroup.startsWith('css-')) {
            this.renderCSSSnippetList();
        } else {
            this.renderPluginList();
        }

        // 恢复滚动位置
        if (scrollableList) {
            // 使用 requestAnimationFrame 确保 DOM 更新完成后再恢复滚动位置
            requestAnimationFrame(() => {
                scrollableList.scrollTop = scrollTop;
            });
        }
    }

    /**
     * 渲染插件列表
     */
    private renderPluginList(): void {

        const pluginItems = this.getPluginData();
        // 提取实际的分组key（移除'plugin-'前缀）
        const actualGroup = this.selectedGroup.replace('plugin-', '');
        const filteredPlugins = filterPlugins(pluginItems, this.searchTerm, this.filterEnabled, actualGroup);
        const sortedPlugins = sortPlugins(filteredPlugins);

        if (sortedPlugins.length === 0) {
            this.showEmptyState();
            return;
        }

        sortedPlugins.forEach((plugin, index) => {
            const wrapper = this.pluginListEl.createDiv();
            this.buildPluginItem(wrapper, plugin);
            
            if (index < sortedPlugins.length - 1) {
                wrapper.createDiv('albus-obsidianx-divider');
            }
        });
    }

    /**
     * 渲染CSS片段列表
     */
    private renderCSSSnippetList(): void {
        const snippetItems = this.getCSSSnippetData();
        const filteredSnippets = this.filterCSSSnippets(snippetItems);
        const sortedSnippets = [...filteredSnippets].sort((a, b) => 
            a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        );

        if (sortedSnippets.length === 0) {
            this.showEmptyState();
            return;
        }

        sortedSnippets.forEach((snippet, index) => {
            const wrapper = this.pluginListEl.createDiv();
            this.buildCSSSnippetItem(wrapper, snippet);
            
            if (index < sortedSnippets.length - 1) {
                wrapper.createDiv('albus-obsidianx-divider');
            }
        });
    }

    /**
     * 构建CSS片段项
     */
    private buildCSSSnippetItem(parent: HTMLElement, snippet: CSSSnippetInfo): void {
        const item = parent.createDiv('albus-obsidianx-plugin-item');

        // 片段信息区域
        const info = item.createDiv('albus-obsidianx-plugin-info');
        this.buildCSSSnippetInfo(info, snippet);

        // 操作按钮区域
        const actions = item.createDiv('albus-obsidianx-plugin-actions');
        this.buildCSSSnippetActions(actions, snippet);
    }

    /**
     * 构建CSS片段信息
     */
    private buildCSSSnippetInfo(parent: HTMLElement, snippet: CSSSnippetInfo): void {
        // 片段标题
        const header = parent.createDiv('albus-obsidianx-plugin-header');
        
        if (this.renamingSnippet?.name === snippet.name) {
            // 显示重命名输入框
            const input = header.createEl('input', {
                type: 'text',
                value: this.renamingSnippet.newName
            });
            input.style.width = '100%';
            input.style.padding = '4px 8px';
            input.style.fontSize = 'var(--font-ui-medium)';
            
            input.addEventListener('input', (e) => {
                if (this.renamingSnippet) {
                    this.renamingSnippet.newName = (e.target as HTMLInputElement).value;
                }
            });
            
            input.addEventListener('blur', () => {
                if (this.renamingSnippet) {
                    this.renameSnippet(this.renamingSnippet.name, this.renamingSnippet.newName);
                }
            });
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (this.renamingSnippet) {
                        this.renameSnippet(this.renamingSnippet.name, this.renamingSnippet.newName);
                    }
                } else if (e.key === 'Escape') {
                    this.renamingSnippet = null;
                    this.refresh();
                }
            });
            
            setTimeout(() => {
                input.focus();
                input.select();
            }, 0);
        } else {
            const name = header.createSpan('albus-obsidianx-plugin-name');
            name.textContent = snippet.name;
        }

        // 描述区域
        this.buildCSSSnippetDescriptionSection(parent, snippet);
    }

    /**
     * 构建CSS片段描述区域
     */
    private buildCSSSnippetDescriptionSection(parent: HTMLElement, snippet: CSSSnippetInfo): void {
        const remarkSection = parent.createDiv('albus-obsidianx-plugin-remark');

        if (this.editingDescription?.snippetName === snippet.name) {
            const textarea = remarkSection.createEl('textarea', {
                cls: 'albus-obsidianx-remark-textarea',
                placeholder: '点击添加描述'
            });
            textarea.value = this.editingDescription.value;
            textarea.rows = 1;

            textarea.addEventListener('input', (e) => {
                if (this.editingDescription) {
                    this.editingDescription.value = (e.target as HTMLTextAreaElement).value;
                }
            });

            textarea.addEventListener('blur', () => {
                this.saveCSSSnippetDescription(snippet.name);
            });

            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.saveCSSSnippetDescription(snippet.name);
                }
            });

            setTimeout(() => textarea.focus(), 0);
        } else {
            const display = remarkSection.createDiv({
                cls: snippet.description ? 'albus-obsidianx-remark-display' : 'albus-obsidianx-remark-display empty'
            });
            const text = display.createSpan('albus-obsidianx-remark-text');
            text.textContent = snippet.description || '点击添加描述';
            
            display.addEventListener('click', () => {
                this.editingDescription = {
                    snippetName: snippet.name,
                    value: snippet.description
                };
                this.updatePluginList();
            });
        }
    }

    /**
     * 构建CSS片段操作按钮
     */
    private buildCSSSnippetActions(parent: HTMLElement, snippet: CSSSnippetInfo): void {
        // 分组按钮
        this.buildCSSSnippetGroupButton(parent, snippet);

        // 打开文件按钮
        const openBtn = parent.createEl('button', {
            cls: 'albus-obsidianx-settings-button',
            attr: { 'aria-label': '打开文件' }
        });
        const openIcon = openBtn.createSpan();
        setIcon(openIcon, 'file-code');
        openBtn.addEventListener('click', () => {
            // @ts-ignore - Obsidian内部API
            this.app.openWithDefaultApp(snippet.path);
        });

        // 重命名按钮
        const renameBtn = parent.createEl('button', {
            cls: 'albus-obsidianx-settings-button',
            attr: { 'aria-label': '重命名CSS片段' }
        });
        const renameIcon = renameBtn.createSpan();
        setIcon(renameIcon, 'text-cursor-input');
        renameBtn.addEventListener('click', () => {
            this.startRenamingSnippet(snippet);
        });

        // 删除按钮
        const deleteBtn = parent.createEl('button', {
            cls: 'albus-obsidianx-delete-button',
            attr: { 'aria-label': '删除CSS片段' }
        });
        const deleteIcon = deleteBtn.createSpan();
        setIcon(deleteIcon, 'trash-2');
        deleteBtn.addEventListener('click', () => {
            this.deleteCSSSnippet(snippet);
        });

        // 启用/禁用开关
        this.buildToggleSwitch(parent, snippet);
    }

    /**
     * 构建CSS片段分组按钮
     */
    private buildCSSSnippetGroupButton(parent: HTMLElement, snippet: CSSSnippetInfo): void {
        const dropdown = parent.createDiv('albus-obsidianx-group-dropdown');
        
        const button = dropdown.createEl('button', {
            cls: 'albus-obsidianx-group-button',
            attr: { 'aria-label': '切换分组' }
        });
        const buttonIcon = button.createSpan();
        setIcon(buttonIcon, 'tag');

        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showGroupDropdown = this.showGroupDropdown === snippet.name ? null : snippet.name;
            this.updatePluginList();
        });

        if (this.showGroupDropdown === snippet.name) {
            const content = dropdown.createDiv('albus-obsidianx-group-dropdown-content');
            const cssGroups = this.dataStorage.getSettings().cssGroups;
            
            Object.keys(cssGroups)
                .filter(key => key !== 'all')
                .forEach(groupKey => {
                    const optionEl = content.createDiv('albus-obsidianx-group-option');
                    if (snippet.group === groupKey) {
                        optionEl.addClass('active');
                    }
                    optionEl.textContent = cssGroups[groupKey] || '';
                    
                    if (snippet.group === groupKey) {
                        const checkIcon = optionEl.createSpan();
                        setIcon(checkIcon, 'check');
                    }

                    optionEl.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        await this.dataStorage.saveCSSSnippetMetadata(snippet.name, { group: groupKey });
                        this.showGroupDropdown = null;
                        this.updateSidebarStats();
                        this.updatePluginList();
                    });
                });
        }
    }

    /**
     * 开始重命名CSS片段
     */
    private startRenamingSnippet(snippet: CSSSnippetInfo): void {
        this.renamingSnippet = {
            name: snippet.name,
            newName: snippet.name
        };
        this.refresh();
    }

    /**
     * 重命名CSS片段
     */
    private async renameSnippet(oldName: string, newName: string): Promise<void> {
        if (!newName.trim()) {
            new Notice('请输入新的片段名称');
            return;
        }

        if (oldName === newName) {
            this.renamingSnippet = null;
            this.refresh();
            return;
        }

        try {
            // @ts-ignore - Obsidian内部API
            const customCss = this.app.customCss;
            const snippetsFolder = customCss.getSnippetsFolder();
            const oldPath = customCss.getSnippetPath(oldName);
            const newPath = `${snippetsFolder}/${newName}.css`;

            // 检查新名称是否已存在
            if (customCss.snippets.includes(newName)) {
                new Notice(`CSS片段 "${newName}" 已存在`);
                return;
            }

            // 重命名文件
            await this.app.vault.adapter.rename(oldPath, newPath);

            // 更新启用状态
            const wasEnabled = customCss.enabledSnippets.has(oldName);
            if (wasEnabled) {
                customCss.setCssEnabledStatus(oldName, false);
                customCss.setCssEnabledStatus(newName, true);
            }

            // 更新元数据
            const metadata = this.dataStorage.getCSSSnippetMetadata(oldName);
            await this.dataStorage.saveCSSSnippetMetadata(newName, metadata);
            await this.dataStorage.deleteCSSSnippetMetadata(oldName);

            // 重新加载CSS片段
            customCss.requestLoadSnippets();

            setTimeout(() => {
                this.renamingSnippet = null;
                this.refresh();
                new Notice(`CSS片段已重命名为 "${newName}"`);
            }, 300);
        } catch (error) {
            console.error('重命名CSS片段失败:', error);
            new Notice('重命名失败');
        }
    }

    /**
     * 保存CSS片段描述
     */
    private async saveCSSSnippetDescription(snippetName: string): Promise<void> {
        if (this.editingDescription && this.editingDescription.snippetName === snippetName) {
            await this.dataStorage.saveCSSSnippetMetadata(snippetName, {
                description: this.editingDescription.value
            });
            this.editingDescription = null;
            this.refresh();
        }
    }

    /**
     * 切换CSS片段状态
     */
    private async toggleCSSSnippet(snippetName: string, enabled: boolean): Promise<void> {
        try {
            // @ts-ignore - Obsidian内部API
            const customCss = this.app.customCss;
            customCss.setCssEnabledStatus(snippetName, enabled);
            new Notice(`${snippetName} ${enabled ? '已启用' : '已禁用'}`);
            this.refresh();
        } catch (error) {
            console.error('切换CSS片段状态失败:', error);
            new Notice('操作失败');
        }
    }

    /**
     * 删除CSS片段
     */
    private async deleteCSSSnippet(snippet: CSSSnippetInfo): Promise<void> {
        const confirmed = await this.showConfirmDialog(
            '删除CSS片段',
            `确定要删除CSS片段 "${snippet.name}" 吗？此操作无法撤销。`
        );

        if (!confirmed) return;

        try {
            // @ts-ignore - Obsidian内部API
            const customCss = this.app.customCss;
            
            // 如果已启用则先禁用
            if (customCss.enabledSnippets.has(snippet.name)) {
                customCss.setCssEnabledStatus(snippet.name, false);
            }

            // 删除文件
            await this.app.vault.adapter.remove(snippet.path);

            // 删除元数据
            await this.dataStorage.deleteCSSSnippetMetadata(snippet.name);

            // 重新加载片段
            customCss.requestLoadSnippets();

            setTimeout(() => {
                this.refresh();
                new Notice(`CSS片段 "${snippet.name}" 已删除`);
            }, 300);
        } catch (error) {
            console.error('删除CSS片段失败:', error);
            new Notice('删除失败');
        }
    }

    /**
     * 显示创建CSS片段对话框
     */
    private showCreateSnippetDialog(): void {
        const modal = new CreateSnippetModal(this.app, async (snippetName: string) => {
            await this.createCSSSnippet(snippetName);
        });
        modal.open();
    }

    /**
     * 创建新的CSS片段
     */
    private async createCSSSnippet(snippetName: string): Promise<void> {
        try {
            // @ts-ignore
            const customCss = this.app.customCss;
            if (!customCss) {
                new Notice('无法访问CSS片段系统');
                return;
            }

            // 确保snippets文件夹存在
            const snippetsPath = `${this.app.vault.configDir}/snippets`;
            if (!await this.app.vault.adapter.exists(snippetsPath)) {
                await this.app.vault.adapter.mkdir(snippetsPath);
            }

            // 检查文件是否已存在
            const filePath = `${snippetsPath}/${snippetName}.css`;
            if (await this.app.vault.adapter.exists(filePath)) {
                new Notice('该CSS片段已存在');
                return;
            }

            // 创建CSS文件，包含模板内容
            const template = `/* ${snippetName} */\n\n/* 在此处添加你的CSS代码 */\n`;
            await this.app.vault.adapter.write(filePath, template);

            // 重新加载片段
            customCss.requestLoadSnippets();

            // 打开刚创建的CSS文件
            // @ts-ignore
            await this.app.openWithDefaultApp(filePath);

            // 等待片段加载完成后再刷新
            setTimeout(() => {
                this.refresh();
                new Notice(`CSS片段 "${snippetName}" 已创建并打开`);
            }, 300);
        } catch (error) {
            console.error('创建CSS片段失败:', error);
            new Notice('创建失败');
        }
    }

    /**
     * 显示确认对话框
     */
    private showConfirmDialog(title: string, message: string): Promise<boolean> {
        return new Promise((resolve) => {
            const modal = new Modal(this.app);
            modal.titleEl.setText(title);
            modal.contentEl.setText(message);
            
            const buttonContainer = modal.contentEl.createDiv('modal-button-container');
            
            const cancelButton = buttonContainer.createEl('button');
            cancelButton.setText('取消');
            cancelButton.addEventListener('click', () => {
                modal.close();
                resolve(false);
            });
            
            const confirmButton = buttonContainer.createEl('button', { cls: 'mod-cta' });
            confirmButton.setText('确认');
            confirmButton.addEventListener('click', () => {
                modal.close();
                resolve(true);
            });
            
            modal.open();
        });
    }

    /**
     * 构建插件项
     */
    private buildPluginItem(parent: HTMLElement, plugin: PluginInfo): void {
        const item = parent.createDiv('albus-obsidianx-plugin-item');

        // 插件信息区域
        const info = item.createDiv('albus-obsidianx-plugin-info');
        this.buildPluginInfo(info, plugin);

        // 操作按钮区域
        const actions = item.createDiv('albus-obsidianx-plugin-actions');
        this.buildPluginActions(actions, plugin);
    }

    /**
     * 构建插件信息
     */
    private buildPluginInfo(parent: HTMLElement, plugin: PluginInfo): void {
        // 插件标题
        const header = parent.createDiv('albus-obsidianx-plugin-header');
        const name = header.createSpan('albus-obsidianx-plugin-name');
        name.textContent = plugin.name;

        if (plugin.isDesktopOnly) {
            const badge = header.createSpan('albus-obsidianx-desktop-only-badge');
            badge.setAttribute('title', '仅桌面端可用');
            const badgeIcon = badge.createSpan();
            setIcon(badgeIcon, 'monitor');
            badge.appendText('仅桌面端');
        }

        // 版本信息
        const versionInfo = parent.createDiv('albus-obsidianx-plugin-version-info');
        const versionText = versionInfo.createSpan('albus-obsidianx-plugin-version-text');
        versionText.textContent = `版本: ${plugin.version}`;

        // 作者信息
        const meta = parent.createDiv('albus-obsidianx-plugin-meta');
        const author = meta.createSpan('albus-obsidianx-plugin-author');
        author.textContent = `作者: ${plugin.author}`;

        // 备注区域
        this.buildRemarkSection(parent, plugin);
    }

    /**
     * 构建描述区域
     */
    private buildRemarkSection(parent: HTMLElement, plugin: PluginInfo): void {
        const remarkSection = parent.createDiv('albus-obsidianx-plugin-remark');

        if (this.editingRemark?.pluginId === plugin.id) {
            const textarea = remarkSection.createEl('textarea', {
                cls: 'albus-obsidianx-remark-textarea',
                placeholder: '点击添加描述'
            });
            textarea.value = this.editingRemark.value;
            textarea.rows = 1;

            // 更新editingRemark的值
            textarea.addEventListener('input', (e) => {
                if (this.editingRemark) {
                    this.editingRemark.value = (e.target as HTMLTextAreaElement).value;
                }
            });

            textarea.addEventListener('blur', () => {
                this.saveRemark(plugin.id);
            });

            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.saveRemark(plugin.id);
                }
            });

            // 自动聚焦
            setTimeout(() => textarea.focus(), 0);
        } else {
            const display = remarkSection.createDiv('albus-obsidianx-remark-display');
            if (!plugin.remark) {
                display.addClass('empty');
            }
            
            const text = display.createSpan('albus-obsidianx-remark-text');
            text.textContent = plugin.remark || '点击添加描述';
            display.setAttribute('title', plugin.remark || '点击添加描述');

            display.addEventListener('click', () => {
                this.editingRemark = { pluginId: plugin.id, value: plugin.remark };
                this.refresh();
            });
        }
    }

    /**
     * 保存备注
     */
    private async saveRemark(pluginId: string): Promise<void> {
        if (!this.editingRemark || this.editingRemark.pluginId !== pluginId) return;

        await this.dataStorage.savePluginMetadata(pluginId, {
            remark: this.editingRemark.value
        });

        this.editingRemark = null;
        this.refresh();
    }

    /**
     * 构建插件操作按钮
     */
    private buildPluginActions(parent: HTMLElement, plugin: PluginInfo): void {
        // 设置按钮
        const settingsBtn = parent.createEl('button', {
            cls: 'albus-obsidianx-settings-button',
            attr: { 'aria-label': plugin.enabled ? '打开插件设置' : '插件未启用，无法打开设置' }
        });
        if (!plugin.enabled) {
            settingsBtn.addClass('disabled');
        }
        const settingsIcon = settingsBtn.createSpan();
        setIcon(settingsIcon, 'settings');
        
        settingsBtn.addEventListener('click', () => {
            if (plugin.enabled) {
                this.openPluginSettings(plugin.id);
            }
        });

        // 分组按钮
        this.buildGroupButton(parent, plugin);

        // 删除按钮
        const deleteBtn = parent.createEl('button', {
            cls: 'albus-obsidianx-delete-button',
            attr: { 'aria-label': '卸载插件' }
        });
        const deleteIcon = deleteBtn.createSpan();
        setIcon(deleteIcon, 'trash-2');
        
        deleteBtn.addEventListener('click', () => {
            this.confirmUninstall(plugin);
        });

        // 启用/禁用开关
        this.buildToggleSwitch(parent, plugin);
    }

    /**
     * 构建分组按钮
     */
    private buildGroupButton(parent: HTMLElement, plugin: PluginInfo): void {
        const dropdown = parent.createDiv('albus-obsidianx-group-dropdown');
        
        const button = dropdown.createEl('button', {
            cls: 'albus-obsidianx-group-button',
            attr: { 'aria-label': '切换分组' }
        });
        const buttonIcon = button.createSpan();
        setIcon(buttonIcon, 'tag');

        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showGroupDropdown = this.showGroupDropdown === plugin.id ? null : plugin.id;
            this.updatePluginList();
        });

        if (this.showGroupDropdown === plugin.id) {
            const content = dropdown.createDiv('albus-obsidianx-group-dropdown-content');
            const groups = this.dataStorage.getSettings().groups;
            
            Object.keys(groups)
                .filter(key => key !== 'all')
                .forEach(groupKey => {
                    const optionEl = content.createDiv('albus-obsidianx-group-option');
                    if (plugin.group === groupKey) {
                        optionEl.addClass('active');
                    }
                    optionEl.textContent = groups[groupKey] || '';
                    
                    if (plugin.group === groupKey) {
                        const checkIcon = optionEl.createSpan();
                        setIcon(checkIcon, 'check');
                    }

                    optionEl.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        await this.dataStorage.savePluginMetadata(plugin.id, { group: groupKey });
                        this.showGroupDropdown = null;
                        this.updateSidebarStats();
                        this.updatePluginList();
                    });
                });
        }
    }

    /**
     * 构建开关
     */
    private buildToggleSwitch(parent: HTMLElement, item: PluginInfo | CSSSnippetInfo): void {
        const toggleComponent = new ToggleComponent(parent);
        toggleComponent.setValue(item.enabled);
        
        if ('id' in item) {
            // 插件
            toggleComponent.setTooltip(item.enabled ? '禁用插件' : '启用插件');
            toggleComponent.onChange(async (value) => {
                await this.togglePluginStatus(item.id);
            });
        } else {
            // CSS片段
            toggleComponent.setTooltip(item.enabled ? '禁用CSS片段' : '启用CSS片段');
            toggleComponent.onChange(async (value) => {
                await this.toggleCSSSnippet(item.name, value);
            });
        }
    }

    /**
     * 显示空状态
     */
    private showEmptyState(): void {
        const emptyState = this.pluginListEl.createDiv('albus-obsidianx-empty-state');
        
        const icon = emptyState.createDiv('albus-obsidianx-empty-icon');
        setIcon(icon, 'package');
        
        const title = emptyState.createEl('h3');
        const isCSSGroup = this.selectedGroup.startsWith('css-');
        title.textContent = isCSSGroup ? '未找到CSS片段' : '未找到插件';
        
        const description = emptyState.createEl('p');
        if (this.searchTerm || this.filterEnabled !== 'all' || this.selectedGroup !== 'all') {
            description.textContent = '尝试调整搜索条件或筛选状态';
        } else {
            description.textContent = isCSSGroup ? '没有任何CSS片段' : '没有安装任何插件';
        }
    }

    /**
     * 切换插件状态
     */
    private async togglePluginStatus(pluginId: string): Promise<void> {
        // @ts-ignore - Obsidian内部API
        const plugin = this.app.plugins.plugins[pluginId];

        if (plugin) {
            // @ts-ignore - Obsidian内部API
            await this.app.plugins.disablePluginAndSave(pluginId);
        } else {
            // @ts-ignore - Obsidian内部API
            await this.app.plugins.enablePluginAndSave(pluginId);
        }
        
        this.refresh();
    }

    /**
     * 打开插件设置
     */
    private openPluginSettings(pluginId: string): void {
        // 关闭当前模态框
        this.close();
        
        // 打开设置页面并定位到插件
        // @ts-ignore
        this.app.setting.open();
        // @ts-ignore
        this.app.setting.openTabById(pluginId);
    }

    /**
     * 确认卸载插件
     */
    private confirmUninstall(plugin: PluginInfo): void {
        const modal = new UninstallConfirmModal(this.app, plugin, async () => {
            await this.uninstallPlugin(plugin.id);
        });
        modal.open();
    }

    /**
     * 卸载插件
     */
    private async uninstallPlugin(pluginId: string): Promise<void> {
        try {
            // 先禁用插件
            // @ts-ignore - Obsidian内部API
            if (this.app.plugins.plugins[pluginId]) {
                // @ts-ignore - Obsidian内部API
                await this.app.plugins.disablePluginAndSave(pluginId);
            }
            
            // 卸载插件
            // @ts-ignore - Obsidian内部API
            await this.app.plugins.uninstallPlugin(pluginId);
            
            // 删除元数据
            await this.dataStorage.deletePluginMetadata(pluginId);
            
            new Notice(`插件 "${pluginId}" 卸载成功`);
            this.refresh();
        } catch (error) {
            console.error('卸载插件失败:', error);
            const message = error instanceof Error ? error.message : String(error);
            new Notice(`卸载插件 "${pluginId}" 失败: ${message}`);
        }
    }

    /**
     * 获取状态标签
     */
    /**
     * 获取分组标签
     */
    private getGroupLabel(): string {
        const groups = this.dataStorage.getSettings().groups;
        return groups[this.selectedGroup] || "全部分组";
    }

    /**
     * 处理点击外部
     */
    private handleClickOutside = (event: MouseEvent): void => {
        const target = event.target as HTMLElement;
        
        const dropdowns = ['.albus-obsidianx-group-dropdown'];
        
        if (!dropdowns.some(selector => target.closest(selector))) {
            if (this.showGroupDropdown) {
                this.showGroupDropdown = null;
                this.refresh();
            }
        }
    }
}

/**
 * 卸载确认模态框
 */
class UninstallConfirmModal extends Modal {
    private plugin: PluginInfo;
    private onConfirm: () => void;

    constructor(app: App, plugin: PluginInfo, onConfirm: () => void) {
        super(app);
        this.plugin = plugin;
        this.onConfirm = onConfirm;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: '卸载插件' });

        const message = contentEl.createEl('p');
        message.textContent = `确定要卸载插件 "`;
        const pluginName = message.createEl('strong');
        pluginName.textContent = this.plugin.name;
        message.appendText('" 吗？');
        message.style.marginTop = '12px';
        message.style.marginBottom = '16px';

        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'flex-end';
        buttonContainer.style.gap = '8px';

        const cancelBtn = buttonContainer.createEl('button', { text: '取消' });
        cancelBtn.addEventListener('click', () => this.close());

        const confirmBtn = buttonContainer.createEl('button', { text: '卸载', cls: 'mod-warning' });
        confirmBtn.addEventListener('click', () => {
            this.onConfirm();
            this.close();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * 创建CSS片段模态框
 */
class CreateSnippetModal extends Modal {
    private onConfirm: (snippetName: string) => void;
    private snippetName = '';

    constructor(app: App, onConfirm: (snippetName: string) => void) {
        super(app);
        this.onConfirm = onConfirm;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: '新建 CSS 片段' });
        
        const input = contentEl.createEl('input', {
            type: 'text',
            placeholder: '输入片段名称'
        });
        input.style.width = '100%';
        input.style.padding = '8px';
        input.style.marginTop = '12px';
        input.style.marginBottom = '16px';

        input.addEventListener('input', (e) => {
            this.snippetName = (e.target as HTMLInputElement).value.trim();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.snippetName) {
                this.confirm();
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

        const confirmBtn = buttonContainer.createEl('button', { text: '创建', cls: 'mod-cta' });
        confirmBtn.addEventListener('click', () => this.confirm());

        setTimeout(() => input.focus(), 10);
    }

    private confirm(): void {
        if (!this.snippetName) {
            new Notice('请输入CSS片段名称');
            return;
        }

        // 移除.css扩展名（如果用户添加了）
        const cleanName = this.snippetName.replace(/\.css$/i, '');
        
        // 验证名称
        if (!/^[a-zA-Z0-9_\-\u4e00-\u9fa5\s]+$/.test(cleanName)) {
            new Notice('片段名称只能包含字母、数字、下划线、横线、中文和空格');
            return;
        }

        this.onConfirm(cleanName);
        this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

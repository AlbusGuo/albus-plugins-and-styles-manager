import { Plugin } from 'obsidian';
import { PluginsStylesManagerSettings, PluginMetadata, CSSSnippetMetadata } from './types';

/**
 * 默认插件分组配置
 */
export const DEFAULT_GROUPS = {
    "all": "全部插件",
    "other": "其他插件"
};

/**
 * 默认CSS片段分组配置
 */
export const DEFAULT_CSS_GROUPS = {
    "all": "全部片段",
    "other": "其他片段"
};

/**
 * 默认设置
 */
export const DEFAULT_SETTINGS: PluginsStylesManagerSettings = {
    groups: { ...DEFAULT_GROUPS },
    cssGroups: { ...DEFAULT_CSS_GROUPS },
    groupColors: {},
    cssGroupColors: {},
    metadata: {},
    cssSnippetMetadata: {}
};

/**
 * 数据存储管理类
 * 负责插件数据的加载、保存和管理
 */
export class DataStorage {
    private plugin: Plugin;
    private settings: PluginsStylesManagerSettings;

    constructor(plugin: Plugin) {
        this.plugin = plugin;
        this.settings = this.createDefaultSettings();
    }

    /**
     * 加载设置数据
     */
    async loadSettings(): Promise<void> {
        const data = await this.plugin.loadData() as Partial<PluginsStylesManagerSettings> | null;

        this.settings = {
            groups: this.normalizeGroups(data?.groups, DEFAULT_GROUPS),
            cssGroups: this.normalizeGroups(data?.cssGroups, DEFAULT_CSS_GROUPS),
            groupColors: this.normalizeRecord(data?.groupColors),
            cssGroupColors: this.normalizeRecord(data?.cssGroupColors),
            metadata: this.normalizePluginMetadata(data?.metadata),
            cssSnippetMetadata: this.normalizeCSSSnippetMetadata(data?.cssSnippetMetadata)
        };

        if (this.pruneMetadataReferences()) {
            await this.saveSettings();
        }
    }

    /**
     * 保存设置数据
     */
    async saveSettings(): Promise<void> {
        await this.plugin.saveData(this.settings);
    }

    /**
     * 获取当前设置
     */
    getSettings(): PluginsStylesManagerSettings {
        return this.settings;
    }

    private createDefaultSettings(): PluginsStylesManagerSettings {
        return {
            groups: { ...DEFAULT_GROUPS },
            cssGroups: { ...DEFAULT_CSS_GROUPS },
            groupColors: {},
            cssGroupColors: {},
            metadata: {},
            cssSnippetMetadata: {}
        };
    }

    private normalizeGroups(
        groups: Record<string, string> | undefined,
        defaults: Record<string, string>
    ): Record<string, string> {
        return {
            ...defaults,
            ...this.normalizeRecord(groups)
        };
    }

    private normalizeRecord(record: Record<string, string> | undefined): Record<string, string> {
        if (!record) {
            return {};
        }

        return Object.fromEntries(
            Object.entries(record).filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
        );
    }

    private normalizePluginMetadata(
        metadata: Record<string, PluginMetadata> | undefined
    ): Record<string, PluginMetadata> {
        if (!metadata) {
            return {};
        }

        const entries = Object.entries(metadata).map(([pluginId, value]) => {
            const normalizedValue = value ?? {} as PluginMetadata;

            return [pluginId, {
                remark: normalizedValue.remark ?? '',
                group: normalizedValue.group ?? 'other',
                lastModified: normalizedValue.lastModified ?? new Date().toISOString()
            } satisfies PluginMetadata];
        });

        return Object.fromEntries(entries);
    }

    private normalizeCSSSnippetMetadata(
        metadata: Record<string, CSSSnippetMetadata> | undefined
    ): Record<string, CSSSnippetMetadata> {
        if (!metadata) {
            return {};
        }

        const entries = Object.entries(metadata).map(([snippetName, value]) => {
            const normalizedValue = value ?? {} as CSSSnippetMetadata;

            return [snippetName, {
                description: normalizedValue.description ?? '',
                group: normalizedValue.group ?? 'other',
                lastModified: normalizedValue.lastModified ?? new Date().toISOString()
            } satisfies CSSSnippetMetadata];
        });

        return Object.fromEntries(entries);
    }

    private pruneMetadataReferences(): boolean {
        let changed = false;

        for (const metadata of Object.values(this.settings.metadata)) {
            if (metadata.group !== 'other' && !(metadata.group in this.settings.groups)) {
                metadata.group = 'other';
                changed = true;
            }
        }

        for (const metadata of Object.values(this.settings.cssSnippetMetadata)) {
            if (metadata.group !== 'other' && !(metadata.group in this.settings.cssGroups)) {
                metadata.group = 'other';
                changed = true;
            }
        }

        for (const groupKey of Object.keys(this.settings.groupColors)) {
            if (!(groupKey in this.settings.groups) || groupKey === 'all' || groupKey === 'other') {
                delete this.settings.groupColors[groupKey];
                changed = true;
            }
        }

        for (const groupKey of Object.keys(this.settings.cssGroupColors)) {
            if (!(groupKey in this.settings.cssGroups) || groupKey === 'all' || groupKey === 'other') {
                delete this.settings.cssGroupColors[groupKey];
                changed = true;
            }
        }

        return changed;
    }

    /**
     * 更新插件分组配置
     */
    async updateGroups(groups: Record<string, string>): Promise<void> {
        this.settings.groups = groups;
        await this.saveSettings();
    }

    /**
     * 更新CSS片段分组配置
     */
    async updateCSSGroups(cssGroups: Record<string, string>): Promise<void> {
        this.settings.cssGroups = cssGroups;
        await this.saveSettings();
    }

    /**
     * 获取插件元数据
     */
    getPluginMetadata(pluginId: string): PluginMetadata {
        return this.settings.metadata[pluginId] || {
            remark: '',
            group: 'other',
            lastModified: new Date().toISOString()
        };
    }

    /**
     * 保存插件元数据
     */
    async savePluginMetadata(pluginId: string, metadata: Partial<PluginMetadata>): Promise<void> {
        const current = this.getPluginMetadata(pluginId);
        this.settings.metadata[pluginId] = {
            ...current,
            ...metadata,
            lastModified: new Date().toISOString()
        };
        await this.saveSettings();
    }

    /**
     * 删除插件元数据
     */
    async deletePluginMetadata(pluginId: string): Promise<void> {
        delete this.settings.metadata[pluginId];
        await this.saveSettings();
    }

    /**
     * 获取CSS片段元数据
     */
    getCSSSnippetMetadata(snippetName: string): CSSSnippetMetadata {
        return this.settings.cssSnippetMetadata[snippetName] || {
            description: '',
            group: 'other',
            lastModified: new Date().toISOString()
        };
    }

    /**
     * 保存CSS片段元数据
     */
    async saveCSSSnippetMetadata(snippetName: string, metadata: Partial<CSSSnippetMetadata>): Promise<void> {
        const current = this.getCSSSnippetMetadata(snippetName);
        this.settings.cssSnippetMetadata[snippetName] = {
            ...current,
            ...metadata,
            lastModified: new Date().toISOString()
        };
        await this.saveSettings();
    }

    /**
     * 删除CSS片段元数据
     */
    async deleteCSSSnippetMetadata(snippetName: string): Promise<void> {
        delete this.settings.cssSnippetMetadata[snippetName];
        await this.saveSettings();
    }

    /**
     * 获取插件分组颜色
     */
    getGroupColor(groupKey: string): string {
        return this.settings.groupColors[groupKey] || '';
    }

    /**
     * 保存插件分组颜色
     */
    async saveGroupColor(groupKey: string, color: string): Promise<void> {
        if (color) {
            this.settings.groupColors[groupKey] = color;
        } else {
            delete this.settings.groupColors[groupKey];
        }
        await this.saveSettings();
    }

    /**
     * 获取CSS片段分组颜色
     */
    getCSSGroupColor(groupKey: string): string {
        return this.settings.cssGroupColors[groupKey] || '';
    }

    /**
     * 保存CSS片段分组颜色
     */
    async saveCSSGroupColor(groupKey: string, color: string): Promise<void> {
        if (color) {
            this.settings.cssGroupColors[groupKey] = color;
        } else {
            delete this.settings.cssGroupColors[groupKey];
        }
        await this.saveSettings();
    }
}

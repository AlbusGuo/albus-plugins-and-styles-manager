import { PluginInfo, FilterType } from './types';

export function isMissingDescriptionSearch(searchTerm: string): boolean {
    return /^[?？]{3}$/.test(searchTerm.trim());
}

/**
 * 过滤插件列表
 */
export function filterPlugins(
    plugins: PluginInfo[],
    searchTerm: string,
    filterEnabled: FilterType,
    selectedGroup: string
): PluginInfo[] {
    return plugins.filter((plugin) => {
        const matchesFilter =
            filterEnabled === "all" ||
            (filterEnabled === "enabled" && plugin.enabled) ||
            (filterEnabled === "disabled" && !plugin.enabled);

        const matchesGroup = selectedGroup === "all" || plugin.group === selectedGroup;

        // 特殊搜索：查找未添加描述的插件
        if (isMissingDescriptionSearch(searchTerm)) {
            return !plugin.remark.trim() && matchesFilter && matchesGroup;
        }

        const lowerSearchTerm = searchTerm.toLowerCase();
        
        // 支持搜索插件名称、描述和作者
        const matchesSearch = lowerSearchTerm === "" ||
            plugin.name.toLowerCase().includes(lowerSearchTerm) ||
            plugin.remark.toLowerCase().includes(lowerSearchTerm) ||
            plugin.description.toLowerCase().includes(lowerSearchTerm) ||
            (plugin.author && plugin.author.toLowerCase().includes(lowerSearchTerm));

        return matchesSearch && matchesFilter && matchesGroup;
    });
}

/**
 * 排序插件列表（按名称）
 */
export function sortPlugins(plugins: PluginInfo[]): PluginInfo[] {
    return [...plugins].sort((a, b) => {
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
}

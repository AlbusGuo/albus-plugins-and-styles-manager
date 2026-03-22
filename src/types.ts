/**
 * 插件元数据接口
 */
export interface PluginMetadata {
    /** 插件备注 */
    remark: string;
    /** 所属分组 */
    group: string;
    /** 最后修改时间 */
    lastModified: string;
}

/**
 * CSS片段元数据接口
 */
export interface CSSSnippetMetadata {
    /** CSS片段描述 */
    description: string;
    /** 所属分组 */
    group: string;
    /** 最后修改时间 */
    lastModified: string;
}

/**
 * 插件信息扩展接口
 */
export interface PluginInfo {
    /** 插件ID */
    id: string;
    /** 插件名称 */
    name: string;
    /** 插件版本 */
    version: string;
    /** 插件作者 */
    author: string;
    /** 插件描述 */
    description: string;
    /** 是否仅桌面端可用 */
    isDesktopOnly: boolean;
    /** 是否已启用 */
    enabled: boolean;
    /** 备注 */
    remark: string;
    /** 所属分组 */
    group: string;
    /** 最后修改时间 */
    lastModified: string;
}

/**
 * CSS片段信息接口
 */
export interface CSSSnippetInfo {
    /** 片段名称 */
    name: string;
    /** 是否已启用 */
    enabled: boolean;
    /** 文件路径 */
    path: string;
    /** 描述 */
    description: string;
    /** 所属分组 */
    group: string;
}

/**
 * 分组配置接口
 */
export interface GroupConfig {
    [key: string]: string;
}

/**
 * 插件设置接口
 */
export interface PluginsStylesManagerSettings {
    /** 插件分组配置 */
    groups: GroupConfig;
    /** CSS片段分组配置 */
    cssGroups: GroupConfig;
    /** 插件分组标签颜色 */
    groupColors: Record<string, string>;
    /** CSS片段分组标签颜色 */
    cssGroupColors: Record<string, string>;
    /** 插件元数据 */
    metadata: Record<string, PluginMetadata>;
    /** CSS片段元数据 */
    cssSnippetMetadata: Record<string, CSSSnippetMetadata>;
}

/**
 * 过滤选项类型
 */
export type FilterType = 'all' | 'enabled' | 'disabled';



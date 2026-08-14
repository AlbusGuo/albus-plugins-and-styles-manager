export interface PluginMetadata {
	remark: string;
	group: string;
}

export interface CSSSnippetMetadata {
	description: string;
	group: string;
}

export interface PluginsStylesManagerSettings {
	groups: Record<string, string>;
	cssGroups: Record<string, string>;
	groupColors: Record<string, string>;
	cssGroupColors: Record<string, string>;
	metadata: Record<string, PluginMetadata>;
	cssSnippetMetadata: Record<string, CSSSnippetMetadata>;
}

export type ManagedGroupType = 'plugin' | 'css';
export type FilterType = 'all' | 'enabled' | 'disabled';

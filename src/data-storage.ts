import type { Plugin } from 'obsidian';
import { asInternalApp } from './internal-api';
import type {
	CSSSnippetMetadata,
	ManagedGroupType,
	PluginMetadata,
	PluginsStylesManagerSettings
} from './types';

const DEFAULT_GROUPS: Record<ManagedGroupType, Record<string, string>> = {
	plugin: {
		all: '全部插件',
		other: '其他插件'
	},
	css: {
		all: '全部片段',
		other: '其他片段'
	}
};

export class DataStorage {
	private settings: PluginsStylesManagerSettings = this.createDefaultSettings();
	private hasPendingCleanup = false;

	constructor(private readonly plugin: Plugin) {}

	async loadSettings(): Promise<void> {
		const data = await this.plugin.loadData() as Partial<PluginsStylesManagerSettings> | null;
		this.settings = {
			groups: this.normalizeGroups(data?.groups, DEFAULT_GROUPS.plugin),
			cssGroups: this.normalizeGroups(data?.cssGroups, DEFAULT_GROUPS.css),
			groupColors: this.normalizeRecord(data?.groupColors),
			cssGroupColors: this.normalizeRecord(data?.cssGroupColors),
			metadata: this.normalizePluginMetadata(data?.metadata),
			cssSnippetMetadata: this.normalizeCSSSnippetMetadata(data?.cssSnippetMetadata)
		};

		const referencesChanged = this.pruneMetadataReferences();
		const orphanedDataChanged = this.pruneOrphanedMetadata();
		this.hasPendingCleanup = referencesChanged || orphanedDataChanged;
	}

	async cleanupOrphanedMetadata(): Promise<void> {
		const referencesChanged = this.pruneMetadataReferences();
		const orphanedDataChanged = this.pruneOrphanedMetadata();
		if (!this.hasPendingCleanup && !referencesChanged && !orphanedDataChanged) return;

		await this.plugin.saveData(this.settings);
		this.hasPendingCleanup = false;
	}

	getGroups(type: ManagedGroupType): Record<string, string> {
		return type === 'plugin' ? this.settings.groups : this.settings.cssGroups;
	}

	async updateGroups(
		type: ManagedGroupType,
		groups: Record<string, string>
	): Promise<void> {
		if (type === 'plugin') {
			this.settings.groups = groups;
		} else {
			this.settings.cssGroups = groups;
		}
		await this.saveSettings();
	}

	getGroupUsageCount(type: ManagedGroupType, groupKey: string): number {
		if (type === 'plugin') {
			return Object.values(this.settings.metadata).filter(
				metadata => metadata.group === groupKey
			).length;
		}
		return Object.values(this.settings.cssSnippetMetadata).filter(
			metadata => metadata.group === groupKey
		).length;
	}

	async deleteGroup(type: ManagedGroupType, groupKey: string): Promise<void> {
		const groups = { ...this.getGroups(type) };
		delete groups[groupKey];

		if (type === 'plugin') {
			this.settings.groups = groups;
			for (const metadata of Object.values(this.settings.metadata)) {
				if (metadata.group === groupKey) metadata.group = 'other';
			}
		} else {
			this.settings.cssGroups = groups;
			for (const metadata of Object.values(this.settings.cssSnippetMetadata)) {
				if (metadata.group === groupKey) metadata.group = 'other';
			}
		}
		await this.saveSettings();
	}

	getGroupColor(type: ManagedGroupType, groupKey: string): string {
		const colors = type === 'plugin'
			? this.settings.groupColors
			: this.settings.cssGroupColors;
		return colors[groupKey] ?? '';
	}

	async saveGroupColor(
		type: ManagedGroupType,
		groupKey: string,
		color: string
	): Promise<void> {
		const colors = type === 'plugin'
			? this.settings.groupColors
			: this.settings.cssGroupColors;
		if (color) {
			colors[groupKey] = color;
		} else {
			delete colors[groupKey];
		}
		await this.saveSettings();
	}

	getPluginMetadata(pluginId: string): PluginMetadata {
		return this.settings.metadata[pluginId] ?? {
			remark: '',
			group: 'other'
		};
	}

	async savePluginMetadata(
		pluginId: string,
		metadata: Partial<PluginMetadata>
	): Promise<void> {
		this.settings.metadata[pluginId] = {
			...this.getPluginMetadata(pluginId),
			...metadata
		};
		await this.saveSettings();
	}

	getCSSSnippetMetadata(snippetName: string): CSSSnippetMetadata {
		return this.settings.cssSnippetMetadata[snippetName] ?? {
			description: '',
			group: 'other'
		};
	}

	async saveCSSSnippetMetadata(
		snippetName: string,
		metadata: Partial<CSSSnippetMetadata>
	): Promise<void> {
		this.settings.cssSnippetMetadata[snippetName] = {
			...this.getCSSSnippetMetadata(snippetName),
			...metadata
		};
		await this.saveSettings();
	}

	async deleteCSSSnippetMetadata(snippetName: string): Promise<void> {
		delete this.settings.cssSnippetMetadata[snippetName];
		await this.saveSettings();
	}

	async moveCSSSnippetMetadata(oldName: string, newName: string): Promise<void> {
		const metadata = this.settings.cssSnippetMetadata[oldName];
		delete this.settings.cssSnippetMetadata[oldName];
		if (metadata) this.settings.cssSnippetMetadata[newName] = metadata;
		await this.saveSettings();
	}

	private async saveSettings(): Promise<void> {
		this.pruneMetadataReferences();
		this.pruneOrphanedMetadata();
		await this.plugin.saveData(this.settings);
		this.hasPendingCleanup = false;
	}

	private createDefaultSettings(): PluginsStylesManagerSettings {
		return {
			groups: { ...DEFAULT_GROUPS.plugin },
			cssGroups: { ...DEFAULT_GROUPS.css },
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
		if (!record) return {};
		return Object.fromEntries(
			Object.entries(record).filter(
				([, value]) => typeof value === 'string' && value.trim().length > 0
			)
		);
	}

	private normalizePluginMetadata(
		metadata: Record<string, PluginMetadata> | undefined
	): Record<string, PluginMetadata> {
		if (!metadata) return {};
		return Object.fromEntries(
			Object.entries(metadata).map(([pluginId, value]) => [pluginId, {
				remark: value?.remark ?? '',
				group: value?.group ?? 'other'
			} satisfies PluginMetadata])
		);
	}

	private normalizeCSSSnippetMetadata(
		metadata: Record<string, CSSSnippetMetadata> | undefined
	): Record<string, CSSSnippetMetadata> {
		if (!metadata) return {};
		return Object.fromEntries(
			Object.entries(metadata).map(([snippetName, value]) => [snippetName, {
				description: value?.description ?? '',
				group: value?.group ?? 'other'
			} satisfies CSSSnippetMetadata])
		);
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

	private pruneOrphanedMetadata(): boolean {
		const internalApp = asInternalApp(this.plugin.app);
		const installedPluginIds = new Set(Object.keys(internalApp.plugins.manifests));
		const existingSnippetNames = new Set(internalApp.customCss.snippets);
		let changed = false;

		for (const pluginId of Object.keys(this.settings.metadata)) {
			if (!installedPluginIds.has(pluginId)) {
				delete this.settings.metadata[pluginId];
				changed = true;
			}
		}
		for (const snippetName of Object.keys(this.settings.cssSnippetMetadata)) {
			if (!existingSnippetNames.has(snippetName)) {
				delete this.settings.cssSnippetMetadata[snippetName];
				changed = true;
			}
		}

		return changed;
	}
}

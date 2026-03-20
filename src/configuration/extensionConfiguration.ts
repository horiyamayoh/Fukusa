import * as vscode from 'vscode';

export type SnapshotOpenMode = 'virtual' | 'tempFile';

type ExtensionSetting<T> = {
  readonly key: string;
  readonly section: string;
  readonly setting: string;
  readonly defaultValue: T;
  readonly enumValues?: readonly T[];
};

export const configurationSettings = {
  blameMode: {
    key: 'multidiff.blame.mode',
    section: 'multidiff',
    setting: 'blame.mode',
    defaultValue: 'age',
    enumValues: ['age']
  },
  blameShowOverviewRuler: {
    key: 'multidiff.blame.showOverviewRuler',
    section: 'multidiff',
    setting: 'blame.showOverviewRuler',
    defaultValue: true
  },
  cacheMaxSizeMb: {
    key: 'multidiff.cache.maxSizeMb',
    section: 'multidiff.cache',
    setting: 'maxSizeMb',
    defaultValue: 512
  },
  snapshotOpenMode: {
    key: 'multidiff.snapshot.openMode',
    section: 'multidiff',
    setting: 'snapshot.openMode',
    defaultValue: 'virtual',
    enumValues: ['virtual', 'tempFile']
  }
} as const satisfies Record<string, ExtensionSetting<string | number | boolean>>;

export const publicConfigurationSettings = Object.freeze(Object.values(configurationSettings));

export function getCacheMaxSizeMb(): number {
  return getConfigurationValue(configurationSettings.cacheMaxSizeMb);
}

export function getBlameShowOverviewRuler(): boolean {
  return getConfigurationValue(configurationSettings.blameShowOverviewRuler);
}

export function getSnapshotOpenMode(): SnapshotOpenMode {
  return getEnumConfigurationValue(configurationSettings.snapshotOpenMode);
}

function getConfigurationValue<T>(setting: ExtensionSetting<T>): T {
  return vscode.workspace.getConfiguration(setting.section).get<T>(setting.setting, setting.defaultValue);
}

function getEnumConfigurationValue<T extends string>(setting: ExtensionSetting<T>): T {
  const value = getConfigurationValue(setting);
  return setting.enumValues?.includes(value) ? value : setting.defaultValue;
}

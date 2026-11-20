/**
 * Trade files: reads any file Big-AGI ever wrote into sections, and writes the export file.
 *
 * Reading writes nothing: what a file holds that cannot be imported is returned as notes, so it can
 * be shown. The adapters read the sections (trade.types.ts).
 */

import { fileOpen, fileSave } from 'browser-fs-access';

import { BaseProduct, Release } from '~/common/app.release';
import { capitalizeFirstLetter } from '~/common/util/textUtils';
import { prettyTimestampForFilenames } from '~/common/util/timeUtils';

import type { TradeFile, TradeItem, TradeSection } from './trade.types';
import { tradeStoreValueSections } from './adapters/trade.settings';


export interface TradeSource {
  fileName: string;
  origin?: { tenantSlug?: string, exported?: string };
  sections: TradeSection[];
  notes: TradeNote[];                   // what the file holds that is not imported
  error?: string;                       // the file could not be read at all
}

export interface TradeNote {
  text: string;                         // one line, with counts
  names?: string[];                     // what was counted, shown on request
}


/// READ ///

export async function tradeFilesPick(): Promise<File[] | null> {
  try {
    return await fileOpen({ description: `${BaseProduct.ProductName} files`, mimeTypes: ['application/json', 'application/big-agi'], multiple: true });
  } catch {
    return null; // the user closed the dialog
  }
}

export async function tradeFilesRead(files: File[]): Promise<TradeSource[]> {
  const sources: TradeSource[] = [];
  for (const file of files) {
    const fileName = file.name || 'unknown file';
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      sources.push({ fileName, sections: [], notes: [], error: 'Not a Big-AGI file: it is not JSON' });
      continue;
    }
    try {
      sources.push(tradeFileRead(fileName, json));
    } catch {
      sources.push({ fileName, sections: [], notes: [], error: 'Not a Big-AGI file: it is damaged' }); // a shape the reader did not expect
    }
  }
  return sources;
}

/**
 * Detection, first match wins:
 * - the export file, by its schema
 * - a device backup, by its shape: its schema was spelled three ways, and its version number never moved
 * - the tagged chat and persona files of the hosted build, by their schema
 * - the untagged chat files, by their keys: 'conversations' is all chats, 'messages' is one
 */
export function tradeFileRead(fileName: string, json: any): TradeSource {
  const source: TradeSource = { fileName, sections: [], notes: [] };
  if (!json || typeof json !== 'object')
    return { ...source, error: 'Not a Big-AGI file' };

  if (json.schema === 'vnd.agi.export')
    _readExport(json, source);
  else if (json.metadata && typeof json.metadata === 'object' && json.storage?.localStorage && typeof json.storage.localStorage === 'object')
    _readDeviceBackup(json, source);
  else if (json.schema === 'vnd.agi.stored-all')
    _readAllChats(json, 'vnd.agi.stored-chat', source);
  else if (json.schema === 'vnd.agi.stored-chat')
    _addSection(source, 'chat', 'vnd.agi.stored-chat', [json]);
  else if (json.schema === 'vnd.agi.stored-personas')
    _addSection(source, 'persona', 'vnd.agi.stored-personas', json.personas, 'personaUid');
  else if ('conversations' in json && !('messages' in json))
    _readAllChats(json, 'rest-chat.v1', source);
  else if ('messages' in json && !('conversations' in json))
    _addSection(source, 'chat', 'rest-chat.v1', [json]);
  else
    return { ...source, error: 'Not a Big-AGI file' };

  // images live outside the conversations, on the device: no file but the device backup holds them
  if (!source.error && !source.notes.some(note => note.text.startsWith('Images'))) {
    const withImages = source.sections.filter(section => section.type === 'chat').flatMap(section => section.items).filter(item => JSON.stringify(item.data).includes('"dblobAssetId"')).length;
    if (withImages)
      source.notes.push({ text: `Images are not in this file: ${_count(withImages, 'conversation shows', 'conversations show')} them only where the device has them` });
  }
  return source;
}

function _readExport(file: Partial<TradeFile>, source: TradeSource): void {
  if (typeof file.schemaVersion !== 'number' || file.schemaVersion > 1 || file.requires?.length) {
    source.error = 'Made by a newer version of Big-AGI';
    return;
  }
  source.origin = _origin(file.origin?.tenantSlug, file.origin?.exported);

  for (const section of Array.isArray(file.sections) ? file.sections : []) {
    if (!section || typeof section.type !== 'string' || typeof section.schema !== 'string' || !Array.isArray(section.items))
      continue;
    if (section.requires?.length) {
      source.notes.push({ text: `Needs a newer version of Big-AGI: ${section.items.length.toLocaleString()} items of kind '${section.type}'` });
      continue;
    }
    const items = section.items.filter(item => !!item && typeof item.id === 'string' && item.data !== undefined);
    if (items.length < section.items.length)
      source.notes.push({ text: `Damaged, not imported: ${(section.items.length - items.length).toLocaleString()} items of kind '${section.type}'` });
    source.sections.push({ type: section.type, schema: section.schema, items });
  }
}

function _readAllChats(json: any, chatSchema: string, source: TradeSource): void {
  _addSection(source, 'chat', chatSchema, json.conversations);
  _addSection(source, 'folder', 'app-folders', json.folders?.folders);
  _addSection(source, 'llm-service', 'llms.service', json.models?.sources);
}

function _readDeviceBackup(json: any, source: TradeSource): void {
  source.origin = _origin(json.tenantSlug, json.metadata.timestamp);

  // the stored values: settings and credentials, the folders
  const values: Record<string, unknown> = json.storage.localStorage;
  const { sections, notExportable } = tradeStoreValueSections(values);
  source.sections.push(...sections);
  _addSection(source, 'folder', 'app-folders', _parseIfString(values['app-folders'])?.state?.folders);

  // A device backup is everything the browser kept for the address the app ran at. What is not imported is
  // counted in one line, by name on request: the state of that device, and what other versions of the app,
  // or other apps at the same address, left there.
  const otherValues = notExportable.filter(key => key !== 'app-folders');
  const otherDatabases: string[] = [];

  const databases: Record<string, any> = json.storage.indexedDB && typeof json.storage.indexedDB === 'object' ? json.storage.indexedDB : {};
  for (const dbName in databases) {
    if (dbName === 'keyval-store') {
      // the chats of a build that keeps them in one stored value, which is a JSON string here
      for (const entry of Array.isArray(databases[dbName]?.keyval) ? databases[dbName].keyval : []) {
        if (entry?.key === 'app-chats') {
          const stored = _parseIfString(entry.value);
          _addSection(source, 'chat', `app-chats.v${stored?.version}`, stored?.state?.conversations);
        } else if (typeof entry?.key === 'string')
          otherValues.push(entry.key); // 'app-chats-v3': the copy of the chats an upgrade left behind
      }
    } else if (dbName === 'Big-AGI')
      source.notes.push({ text: 'Images are in this backup: the device restore, under Advanced, brings them back and replaces everything on this device' });
    else
      otherDatabases.push(dbName);
  }

  if (otherValues.length || otherDatabases.length)
    source.notes.unshift({
      text: `Not imported: ${[
        otherValues.length && _count(otherValues.length, 'stored value', 'stored values'),
        otherDatabases.length && _count(otherDatabases.length, 'database', 'databases'),
      ].filter(Boolean).join(' and ')} of this backup, which belong to its device or to other versions of the app`,
      names: [...otherValues, ...otherDatabases],
    });
}

function _addSection(source: TradeSource, type: string, schema: string, list: unknown, idKey: string = 'id'): void {
  if (!Array.isArray(list) || !list.length) return;
  const items: TradeItem[] = [];
  for (const data of list)
    if (data && typeof data === 'object' && typeof data[idKey] === 'string')
      items.push({ id: data[idKey], data });
  if (items.length < list.length)
    source.notes.push({ text: `Without an id, not imported: ${(list.length - items.length).toLocaleString()} items of kind '${type}'` });
  if (items.length)
    source.sections.push({ type, schema, items });
}

function _count(count: number, one: string, many: string): string {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`;
}

function _origin(tenantSlug: unknown, exported: unknown): TradeSource['origin'] {
  return {
    ...(typeof tenantSlug === 'string' && { tenantSlug }),
    ...(typeof exported === 'string' && { exported }),
  };
}

function _parseIfString(value: unknown): any {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}


/// WRITE ///

/**
 * @throws {DOMException} AbortError if the user closes the save dialog
 */
export async function tradeFileSave(sections: TradeSection[]): Promise<{ fileName: string, sizeBytes: number }> {
  const file: TradeFile = {
    schema: 'vnd.agi.export',
    schemaVersion: 1,
    origin: {
      app: 'Big-AGI',
      tenantSlug: Release.TenantSlug,
      exported: new Date().toISOString(),
    },
    sections,
  };
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
  const fileName = `Big-AGI-${capitalizeFirstLetter(Release.TenantSlug)}-export-${prettyTimestampForFilenames(false)}.agi.json`;
  // only '.json': Chrome's file picker rejects the compound '.agi.json' as an extension; the file name carries it
  await fileSave(blob, { fileName, extensions: ['.json'] });
  return { fileName, sizeBytes: blob.size };
}

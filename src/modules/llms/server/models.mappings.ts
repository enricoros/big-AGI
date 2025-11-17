import type { ModelDescriptionSchema } from './llm.server.types';


// -- Manual model mappings: types and helper --

export type ManualMappings = (KnownModel | KnownLink)[];

/**
 * Server-side default model description to complement the APIs usually just returning the model ID
 */
export type KnownModel = {
  idPrefix: string,
  isPreview?: boolean,
  isLegacy?: boolean,
} & Omit<ModelDescriptionSchema, 'id' | 'created' | 'updated'>;

/**
 * Symlink -> KnownModel; all properties except overrides are inherited from the target model.
 */
type KnownLink = {
  idPrefix: string;
  label: string;        // Forcing the label, otherwise we'll just use the target's, which is wrong
  symLink: string;      // -> KnownModel.idPrefix
} & Partial<Omit<ModelDescriptionSchema, 'id' | 'created' | 'updated'>>;


export function fromManualMapping(mappings: (KnownModel | KnownLink)[], upstreamModelId: string, created: undefined | number, updated: undefined | number, fallback: KnownModel, disableSymlinkLooks?: boolean): ModelDescriptionSchema {

  // model resolution outputs
  let m: KnownModel;
  let symlinkTarget: string | undefined;
  let resolution: 'exact' | 'super' | 'fallback' = 'exact';

  // just scope this to avoid leaking
  {
    // find a perfect match first
    let known = mappings.find(base => upstreamModelId === base.idPrefix);
    if (!known) {
      // find the longest prefix match
      const prefixMatches = mappings.filter(base => upstreamModelId.startsWith(base.idPrefix));
      if (prefixMatches.length) {
        known = prefixMatches.sort((a, b) => b.idPrefix.length - a.idPrefix.length)[0];
        resolution = 'super';
      } else {
        // fallback last
        // console.warn(`[fromManualMapping] Unknown model: ${upstreamModelId}, falling back to ${fallback.idPrefix}`);
        known = fallback;
        resolution = 'fallback';
      }
    }

    // dereference symlink
    if ('symLink' in known) {
      const l = known;
      symlinkTarget = l.symLink;
      const lM = mappings.find(m => m.idPrefix === l.symLink);
      if (lM && !('symLink' in lM)) {
        // merge target + link overrides (symlinks are hidden by default)
        const { idPrefix, symLink, hidden = undefined, ...overrides } = l;
        m = {
          ...lM,
          ...overrides,
          idPrefix, // NOTE: we use the 'base' for broader variant extraction below
          hidden: hidden ?? true, // by default hide symlinks, unless overridden
        };
      } else {
        // WARNING: we found a symlink, but the target is missing or another symlink - hence we fallback, but this is a warning situation
        console.warn(!lM
          ? `[fromManualMapping] Symlink target not found: ${l.idPrefix} -> ${l.symLink}`
          : `[fromManualMapping] Symlink chain detected: ${l.idPrefix} -> ${l.symLink} (not supported)`,
        );
        m = fallback;
        resolution = 'fallback';
      }
    } else {
      m = known;
    }
  }

  // check whether this is a partial map, which indicates an unknown/new variant
  const variant = upstreamModelId.slice(m.idPrefix.length).replaceAll('-', ' ').trim();

  // build label (a bit tricky)
  let label = m.label;
  let description = m.description || '';
  if (variant)
    label += ` [${variant}]`;
  if (resolution === 'super') {
    label = `[?] ${label}`;
    delete m.hidden;
  } else if (!disableSymlinkLooks && symlinkTarget) {
    // add a symlink icon to the label
    label = `🔗 ${label} → ${symlinkTarget/*.replace(known.idPrefix, '')*/}`;

    // add an automated 'points to...' to the description, lifted from the base model
    if (!description.includes('Points to '))
      description += ` Points to ${symlinkTarget}.`;
  }
  // if (m.isLegacy) label += /*' 💩'*/ ' [legacy]'; // Disabled: visual noise

  // create ModelDescription
  const md: ModelDescriptionSchema = {
    id: upstreamModelId,
    label,
    created: created || 0,
    updated: updated || created || 0,
    description,
    contextWindow: m.contextWindow,
    interfaces: m.interfaces,
  };

  // apply optional fields
  if (m.parameterSpecs) md.parameterSpecs = m.parameterSpecs;
  if (m.maxCompletionTokens) md.maxCompletionTokens = m.maxCompletionTokens;
  if (m.trainingDataCutoff) md.trainingDataCutoff = m.trainingDataCutoff;
  if (m.benchmark) md.benchmark = m.benchmark;
  if (m.chatPrice) md.chatPrice = m.chatPrice;
  if (m.hidden) md.hidden = true;

  return md;
}
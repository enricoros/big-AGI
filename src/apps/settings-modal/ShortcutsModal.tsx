import * as React from 'react';

import { Box, Chip, Divider, IconButton, Tooltip, Typography } from '@mui/joy';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import { GoodModal } from '~/common/components/modals/GoodModal';
import type { ShortcutDefinition } from '~/common/components/shortcuts/useGlobalShortcuts';
import { shortcutsCatalog } from '~/common/components/shortcuts/shortcutsCatalog';
import { shortcutFingerprint, useShortcutsPreferencesStore } from '~/common/components/shortcuts/store-shortcuts-preferences';
import { useGlobalShortcutsStore } from '~/common/components/shortcuts/store-global-shortcuts';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { Is } from '~/common/util/pwaUtils';


// Styles

const _styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
    gap: 0.75,
    columnGap: { md: 3 },
    alignItems: 'center',
  },
  categoryLabel: {
    gridColumn: { md: '1 / -1' },
    mt: 1.5,
    mb: 0.5,
    '&:first-of-type': { mt: 0 },
  },
  categoryDivider: {
    gridColumn: { md: '1 / -1' },
    mt: 1,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 1,
  },
  rowLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
  },
  keys: {
    display: 'flex',
    gap: 0.5,
    flexShrink: 0,
  },
} as const;


function _platformModifier(mod: string): string {
  if (!Is.OS.MacOS) return mod;
  switch (mod) {
    case 'Ctrl':
      return '⌃';
    case 'Shift':
      return '⇧';
    case 'Alt':
      return '⌥';
    default:
      return mod;
  }
}

function _displayKey(key: string): string {
  switch (key) {
    case 'ArrowUp':
      return '↑';
    case 'ArrowDown':
      return '↓';
    case 'ArrowLeft':
      return '←';
    case 'ArrowRight':
      return '→';
    case 'Backspace':
      return '⌫';
    default:
      return key.length === 1 ? key.toUpperCase() : key;
  }
}

/**
 * Build a set of fingerprints from currently registered shortcuts for active detection.
 * Fingerprint: `key_lowercase:ctrl:shift` - matches the global handler resolution.
 */
function _buildActiveFingerprints(): Set<string> {
  const allShortcuts = useGlobalShortcutsStore.getState().getAllShortcuts();
  const fingerprints = new Set<string>();
  for (const s of allShortcuts) {
    if (!s.disabled)
      fingerprints.add(`${s.key.toLowerCase()}:${!!s.ctrl}:${!!s.shift}`);
  }
  return fingerprints;
}

function _isActive(def: ShortcutDefinition, fingerprints: Set<string>): boolean {
  return fingerprints.has(`${def.key.toLowerCase()}:${!!def.ctrl}:${!!def.shift}`);
}


function ShortcutKeyCombo(props: { def: ShortcutDefinition }) {
  const { ctrl, shift, alt, key } = props.def;
  const parts: string[] = [];
  if (ctrl) parts.push(_platformModifier('Ctrl'));
  if (shift) parts.push(_platformModifier('Shift'));
  if (alt) parts.push(_platformModifier('Alt'));
  parts.push(_displayKey(key));
  return (
    <Box sx={_styles.keys}>
      {parts.map((part, i) =>
        <Chip key={i} size='sm' variant='soft' color='neutral'>{part}</Chip>,
      )}
    </Box>
  );
}


function ShortcutRow(props: { item: typeof shortcutsCatalog[number]['items'][number], active: boolean }) {
  const { item, active } = props;

  const fp = shortcutFingerprint(item);
  const isDenied = useShortcutsPreferencesStore((state) => state.disabledShortcuts.includes(fp));

  const handleToggle = React.useCallback(() => {
    useShortcutsPreferencesStore.getState().toggleShortcutDisabled(fp);
  }, [fp]);

  const effectivelyActive = active && !isDenied;

  return (
    <Box sx={_styles.row}>
      <Box sx={_styles.rowLeft}>
        <Tooltip title={isDenied ? 'Enable shortcut' : 'Disable shortcut'} variant='soft'>
          <IconButton
            size='sm'
            variant={isDenied ? 'soft' : 'plain'}
            color={isDenied ? 'danger' : 'neutral'}
            onClick={handleToggle}
            sx={{ minWidth: 28, minHeight: 28 }}
          >
            {isDenied ? <BlockIcon sx={{ fontSize: 16 }} /> : <CheckCircleOutlineIcon sx={{ fontSize: 16, opacity: 0.5 }} />}
          </IconButton>
        </Tooltip>
        <ShortcutKeyCombo def={item} />
      </Box>
      <Typography level='body-xs' sx={!effectivelyActive ? { opacity: 0.5, textDecoration: isDenied ? 'line-through' : undefined } : undefined}>
        {item.description}
      </Typography>
    </Box>
  );
}


export function ShortcutsModal(props: { onClose: () => void }) {

  // external state
  const isMobile = useIsMobile();

  // build active fingerprints once at render time
  const activeFingerprints = React.useMemo(_buildActiveFingerprints, []);

  return (
    <GoodModal open fullscreen={isMobile} title='Keyboard Shortcuts' onClose={props.onClose}>
      <Box sx={_styles.grid}>
        {shortcutsCatalog.map((category, ci) => (
          <React.Fragment key={category.label}>
            {ci > 0 && <Divider sx={_styles.categoryDivider} />}
            <Typography level='body-xs' textTransform='uppercase' fontWeight='lg' sx={_styles.categoryLabel}>
              {category.label}
            </Typography>
            {category.items.map((item, i) => {
              const active = _isActive(item, activeFingerprints);
              return <ShortcutRow key={i} item={item} active={active} />;
            })}
          </React.Fragment>
        ))}
      </Box>
    </GoodModal>
  );
}

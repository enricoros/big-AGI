import type { SxProps } from '@mui/joy/styles/types';

// BEAM recap - Nomenclature:
//  - Beam (public name) = Scatter (technology process) -> Ray[] (single scatter thread)
//  - Merge (public name) = Gather (technology process) -> Fusion[] (single gather thread)

// configuration [BEAM Common]
export const BEAM_INVERT_BACKGROUND = true;
export const BEAM_BTN_SX: SxProps = { minWidth: 128 };

// configuration [BEAM Scatter]
export const SCATTER_COLOR = 'neutral' as const;
export const SCATTER_DEBUG_STATE = false;
export const SCATTER_PLACEHOLDER = '🖊️ ...'; // 💫 ..., 🖊️ ...
export const SCATTER_RAY_DEF = 2;
export const SCATTER_RAY_MAX = 8;
export const SCATTER_RAY_MIN = 1;
export const SCATTER_RAY_PRESETS = [2, 4, 8];
export const SCATTER_RAY_SHOW_DRAG_HANDLE = false;

// configuration [BEAM Gather]
export const GATHER_COLOR = 'success' as const;
export const GATHER_PLACEHOLDER = '📦 ...';

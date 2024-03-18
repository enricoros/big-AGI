// BEAM recap - Nomenclature:
//  - Beam (public name) = Scatter (technology process) -> Ray[] (single scatter thread)
//  - Merge (public name) = Gather (technology process) -> Fusion[] (single gather thread)

// BEAM configuration
export const SCATTER_RAY_MIN = 1;
export const SCATTER_RAY_DEF = 2;
export const SCATTER_RAY_MAX = 8;
export const SCATTER_RAY_PRESETS = [2, 4, 8];
export const SCATTER_RAY_SHOW_DRAG_HANDLE = false;
// BEAM placeholder strings
export const SCATTER_PLACEHOLDER = '🖊️ ...'; // 💫 ..., 🖊️ ...
export const GATHER_PLACEHOLDER = '📦 ...';

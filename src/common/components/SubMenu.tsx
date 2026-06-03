import * as React from 'react';

import type { PopperPlacementType } from '@mui/base';
import { ListItemDecorator, MenuItem } from '@mui/joy';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

import { themeZIndexOverMobileDrawer } from '~/common/app.theme';

import { CloseablePopup } from './CloseablePopup';


/**
 * SubMenu: a reusable submenu-item pattern for Joy <Menu>/<CloseablePopup> parents.
 *
 * Why it exists: opening a submenu from inside a menu repeats the same boilerplate every time
 * (anchor state, the `defaultMuiPrevented` trick to keep the parent open, the right-arrow affordance,
 * the conditional <CloseablePopup>, responsive placement, and the parent's keep-open veto).
 *
 * Architecture (Option 1 - component + host):
 *  - <SubMenuItem> owns its own open/close anchor state (re-renders stay local = performant).
 *  - <SubMenuHost> provides a stable controller via context AND renders the popups in an OUTLET that
 *    sits OUTSIDE the parent <Menu>'s React subtree. This is required: React events bubble through the
 *    React tree, so a popup rendered inside the <Menu> would leak its arrow-key/Escape/click events into
 *    the parent Menu. The outlet subscribes to the controller via useSyncExternalStore, so toggling a
 *    submenu re-renders only the trigger item + the outlet - never the parent menu.
 *  - The parent reads `host.isAnyOpen()` in its onOpenChange to veto closing while a submenu is open,
 *    and calls `host.closeAll()` when it actually closes.
 */


// --- controller (stable, ref-counted store of currently-open submenu popups) ---

interface SubMenuDescriptor {
  id: number;
  parentId: number; // 0 = top-level; otherwise the id of the enclosing SubMenuItem (for nesting-safe single-open)
  anchorEl: HTMLElement;
  content: React.ReactNode;
  placement: PopperPlacementType;
  minWidth?: number;
  zIndex?: number;
  onClose: () => void;
}

export interface SubMenuHostController {
  /** Synchronously true if any submenu is open. Read in the parent menu's onOpenChange to veto closing. */
  isAnyOpen: () => boolean;
  /** Close every open submenu. Call when the parent menu actually closes. */
  closeAll: () => void;
  // -- internal (SubMenuItem / outlet) --
  _nextId: () => number;
  _upsert: (d: SubMenuDescriptor) => void;
  _remove: (id: number) => void;
  /** Sibling-scoped single-open: close everything except the opening item and its ancestor chain (so nesting survives). */
  _closeNonAncestors: (keepId: number, keepParentId: number) => void;
  _subscribe: (cb: () => void) => () => void;
  _getSnapshot: () => readonly SubMenuDescriptor[];
}

function createSubMenuController(): SubMenuHostController {
  const map = new Map<number, SubMenuDescriptor>();
  const subscribers = new Set<() => void>();
  let snapshot: readonly SubMenuDescriptor[] = [];
  let idSeq = 0;

  const _publish = () => {
    snapshot = Array.from(map.values());
    subscribers.forEach(cb => cb());
  };

  return {
    isAnyOpen: () => map.size > 0,
    closeAll: () => Array.from(map.values()).forEach(d => d.onClose()),
    _nextId: () => ++idSeq,
    _upsert: (d) => {
      map.set(d.id, d);
      _publish();
    },
    _remove: (id) => {
      if (map.delete(id)) _publish();
    },
    _closeNonAncestors: (keepId, keepParentId) => {
      // walk up the parent chain of the opening item so its ancestors stay open
      const keep = new Set<number>([keepId]);
      let p = keepParentId;
      while (p) {
        keep.add(p);
        p = map.get(p)?.parentId ?? 0;
      }
      map.forEach(d => !keep.has(d.id) && d.onClose());
    },
    _subscribe: (cb) => {
      subscribers.add(cb);
      return () => void subscribers.delete(cb);
    },
    _getSnapshot: () => snapshot,
  };
}

/** Create a stable SubMenu host controller. Call this in the component that owns the parent menu. */
export function useSubMenuHost(): SubMenuHostController {
  const ref = React.useRef<SubMenuHostController | null>(null);
  if (!ref.current) ref.current = createSubMenuController();
  return ref.current;
}


// --- host (context provider + popup outlet) ---

const SubMenuHostContext = React.createContext<SubMenuHostController | null>(null);

// id of the enclosing SubMenuItem (0 = top-level). Lets a nested SubMenuItem know its parent so single-open spares ancestors.
const SubMenuParentIdContext = React.createContext<number>(0);

export function SubMenuHost(props: { host: SubMenuHostController, children: React.ReactNode }) {
  const descriptors = React.useSyncExternalStore(props.host._subscribe, props.host._getSnapshot, props.host._getSnapshot);
  return (
    <SubMenuHostContext.Provider value={props.host}>
      {props.children}
      {descriptors.map(d => (
        <CloseablePopup key={d.id} menu anchorEl={d.anchorEl} onClose={d.onClose} placement={d.placement} zIndex={d.zIndex} minWidth={d.minWidth}>
          {/* provide this popup's id so any nested <SubMenuItem> in the content learns its parentId */}
          <SubMenuParentIdContext.Provider value={d.id}>
            {d.content}
          </SubMenuParentIdContext.Provider>
        </CloseablePopup>
      ))}
    </SubMenuHostContext.Provider>
  );
}


// --- submenu item ---

/**
 * A menu item that opens a submenu popup. Must be rendered within a <SubMenuHost>.
 * Encapsulates: the trigger row (decorator + label + right arrow), open/close anchor state,
 * the parent keep-open trick, single-open behavior, and responsive (mobile-safe) placement.
 */
export function SubMenuItem(props: {
  label: React.ReactNode,
  decorator?: React.ReactNode, // left ListItemDecorator content (empty spacer if omitted, for alignment)
  disabled?: boolean,
  isMobile: boolean, // required: pass the parent menu's mobile flag (avoids a redundant media-query subscription per item)
  // popup
  children?: React.ReactNode,
  minWidth?: number,
  zIndex?: number, // defaults to themeZIndexOverMobileDrawer (submenus usually float above drawers/modals)
  desktopPlacement?: PopperPlacementType, // default 'right-start'
  mobilePlacement?: PopperPlacementType, // default 'bottom-start' (right-start gets chopped off on narrow viewports)
}) {

  // state
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);

  // external state
  const host = React.useContext(SubMenuHostContext);
  const parentId = React.useContext(SubMenuParentIdContext); // 0 at top-level, else the enclosing SubMenuItem's id

  // stable per-instance id
  const idRef = React.useRef<number>(0);
  if (!idRef.current && host) idRef.current = host._nextId();

  // resolved popup config (kept in a ref so the click handler can register synchronously)
  const placement: PopperPlacementType = props.isMobile ? (props.mobilePlacement ?? 'bottom-start') : (props.desktopPlacement ?? 'right-start');
  const zIndex = props.zIndex ?? themeZIndexOverMobileDrawer;
  const cfgRef = React.useRef<Omit<SubMenuDescriptor, 'id' | 'anchorEl' | 'onClose'>>({ parentId, content: undefined, placement, minWidth: props.minWidth, zIndex });
  // store raw children; the host wraps them with this item's id so nested <SubMenuItem>s learn their parentId
  cfgRef.current = { parentId, content: props.children, placement, minWidth: props.minWidth, zIndex };

  const handleClose = React.useCallback(() => {
    setAnchorEl(null);
    host?._remove(idRef.current);
  }, [host]);

  const handleTriggerClick = React.useCallback((event: React.MouseEvent) => {
    // the key to not close the parent (Joy) Menu when activating this item - REV ENG
    (event as any).defaultMuiPrevented = true;
    if (anchorEl) {
      handleClose();
    } else {
      const target = event.currentTarget as HTMLElement;
      host?._closeNonAncestors(idRef.current, parentId); // single-open among siblings; keep ancestors open
      setAnchorEl(target);
      host?._upsert({ id: idRef.current, anchorEl: target, onClose: handleClose, ...cfgRef.current });
    }
  }, [anchorEl, host, handleClose, parentId]);

  // keep the registered popup's content/placement fresh while open, and unregister on close/unmount
  React.useEffect(() => {
    if (!host || !anchorEl) return;
    host._upsert({ id: idRef.current, anchorEl, onClose: handleClose, ...cfgRef.current });
    return () => host._remove(idRef.current);
  }, [host, anchorEl, handleClose, props.children, placement, props.minWidth, zIndex]);

  return (
    <MenuItem disabled={props.disabled} onClick={handleTriggerClick}>
      <ListItemDecorator>{props.decorator}</ListItemDecorator>
      {props.label}
      <KeyboardArrowRightIcon sx={{ ml: 'auto' }} />
    </MenuItem>
  );
}

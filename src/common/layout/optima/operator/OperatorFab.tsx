import * as React from 'react';
import { keyframes } from '@emotion/react';

import { Box, Chip } from '@mui/joy';
import AddCommentOutlinedIcon from '@mui/icons-material/AddCommentOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';

import { BigAgiCircleIcon } from '~/common/components/icons/big-agi/BigAgiCircleIcon';
import { PhHouse } from '~/common/components/icons/phosphor/PhHouse';
import { brandLime } from '~/common/app.theme';
import { useIsMobile } from '~/common/components/useMatchMedia';

import { OperatorActionId, operatorDispatch } from './operator.actions';
import { OperatorVoiceSheet } from './OperatorVoiceSheet';
import { OperatorFabStatus, useOperatorStore } from './store-operator';


// configuration
const FAB_SIZE = 56;
const MINI_SIZE = 44;
const EDGE = 14;
const DRAG_THRESHOLD = 6;
const LONG_PRESS_MS = 450;
const Z_FAB = 1200; // above page content, below modals (1300)

const FAB_BG = '#0d1114';          // darker than the app chrome on purpose
const FAB_BG_ACTIVE = '#1b2228';


const ringPulse = keyframes`
  0% { transform: scale(1); opacity: 0.85; }
  70% { transform: scale(1.45); opacity: 0; }
  100% { transform: scale(1.45); opacity: 0; }
`;

const statusRingColor: Record<OperatorFabStatus, string | null> = {
  idle: null,
  listening: brandLime,
  rambling: '#e5484d',
  devices: '#3e9bff',
};


interface DialItem {
  id: OperatorActionId | 'voice';
  label: string;
  icon: React.ReactNode;
  soon?: boolean;
  primary?: boolean;
}

// ordered from the FAB outwards
const DIAL_ITEMS: DialItem[] = [
  { id: 'voice', label: 'Talk to Big-AGI', icon: <MicRoundedIcon />, primary: true },
  { id: 'chat-new', label: 'New chat', icon: <AddCommentOutlinedIcon /> },
  { id: 'chat-incognito', label: 'Incognito chat', icon: <VisibilityOffOutlinedIcon /> },
  { id: 'doc-new', label: 'New document', icon: <DescriptionOutlinedIcon />, soon: true },
  { id: 'home', label: 'Home', icon: <PhHouse /> },
];


export function OperatorFab(props: { forceShow?: boolean }) {

  // state
  const [open, setOpen] = React.useState(false);
  const [voiceOpen, setVoiceOpen] = React.useState(false);
  const [dragXY, setDragXY] = React.useState<{ x: number, y: number } | null>(null);
  const [viewportH, setViewportH] = React.useState(800);
  const gestureRef = React.useRef<{ x0: number, y0: number, dragging: boolean, longPressed: boolean, timer: any } | null>(null);

  // external state
  const isMobile = useIsMobile();
  const { fabEnabled, fabSide, fabBottom, fabStatus, setFabPosition } = useOperatorStore();

  React.useEffect(() => {
    const update = () => setViewportH(window.innerHeight);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);


  // gestures: tap = toggle dial, drag = move + snap to edge, long-press = talk

  const handlePointerDown = React.useCallback((e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const g = { x0: e.clientX, y0: e.clientY, dragging: false, longPressed: false, timer: null as any };
    g.timer = setTimeout(() => {
      if (!g.dragging) {
        g.longPressed = true;
        setOpen(false);
        setVoiceOpen(true);
      }
    }, LONG_PRESS_MS);
    gestureRef.current = g;
  }, []);

  const handlePointerMove = React.useCallback((e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g || g.longPressed) return;
    if (!g.dragging && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > DRAG_THRESHOLD) {
      g.dragging = true;
      clearTimeout(g.timer);
      setOpen(false);
    }
    if (g.dragging)
      setDragXY({ x: e.clientX, y: e.clientY });
  }, []);

  const handlePointerUp = React.useCallback((e: React.PointerEvent) => {
    const g = gestureRef.current;
    gestureRef.current = null;
    if (!g) return;
    clearTimeout(g.timer);
    if (g.dragging) {
      const side = e.clientX < window.innerWidth / 2 ? 'left' : 'right';
      const bottom = Math.max(FAB_SIZE + 24, Math.min(window.innerHeight - FAB_SIZE - 24, window.innerHeight - e.clientY));
      setFabPosition(side, Math.round(bottom));
      setDragXY(null);
    } else if (!g.longPressed)
      setOpen(o => !o);
  }, [setFabPosition]);


  const handleItem = React.useCallback((id: DialItem['id']) => {
    setOpen(false);
    if (id === 'voice')
      setVoiceOpen(true);
    else
      operatorDispatch(id);
  }, []);


  if (!fabEnabled || (!isMobile && !props.forceShow))
    return null;

  // geometry
  const opensUp = fabBottom < viewportH * 0.6;
  const fabStyle: React.CSSProperties = dragXY
    ? { left: dragXY.x - FAB_SIZE / 2, top: dragXY.y - FAB_SIZE / 2 }
    : { [fabSide]: EDGE, bottom: fabBottom - FAB_SIZE / 2 };
  const dialStyle: React.CSSProperties = {
    [fabSide]: EDGE + (FAB_SIZE - MINI_SIZE) / 2,
    ...(opensUp ? { bottom: fabBottom + FAB_SIZE / 2 + 14 } : { top: viewportH - fabBottom + FAB_SIZE / 2 + 14 }),
  };
  const ringColor = voiceOpen ? statusRingColor.listening : statusRingColor[fabStatus];

  return <>

    {/* Backdrop */}
    <Box
      onClick={() => setOpen(false)}
      sx={{
        position: 'fixed', inset: 0, zIndex: Z_FAB - 1,
        backgroundColor: 'rgba(8, 10, 12, 0.42)',
        backdropFilter: 'blur(2px)',
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none',
        transition: 'opacity 0.18s ease',
      }}
    />

    {/* Speed dial */}
    <Box
      sx={{
        position: 'fixed', zIndex: Z_FAB,
        display: 'flex', flexDirection: opensUp ? 'column-reverse' : 'column', gap: 1.25,
        alignItems: fabSide === 'right' ? 'flex-end' : 'flex-start',
        pointerEvents: open ? 'auto' : 'none',
      }}
      style={dialStyle}
    >
      {DIAL_ITEMS.map((item, idx) => (
        <Box
          key={item.id}
          onClick={() => handleItem(item.id)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.25,
            flexDirection: fabSide === 'right' ? 'row-reverse' : 'row',
            cursor: 'pointer',
            opacity: open ? 1 : 0,
            transform: open ? 'none' : `translateY(${opensUp ? 12 : -12}px) scale(0.85)`,
            transition: 'opacity 0.16s ease, transform 0.2s cubic-bezier(.2,.9,.3,1.2)',
            transitionDelay: open ? `${idx * 28}ms` : '0ms',
          }}
        >
          {/* Mini button */}
          <Box sx={{
            width: MINI_SIZE, height: MINI_SIZE, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'md',
            ...(item.primary ? {
              backgroundColor: brandLime, color: '#0d1114',
            } : {
              backgroundColor: 'background.surface', color: 'text.primary',
              border: '1px solid', borderColor: 'neutral.outlinedBorder',
            }),
            opacity: item.soon ? 0.75 : 1,
            '& svg': { fontSize: item.primary ? '1.5rem' : '1.3rem' },
          }}>
            {item.icon}
          </Box>
          {/* Label */}
          <Box sx={{
            px: 1.25, py: 0.5, borderRadius: 'sm',
            backgroundColor: item.primary ? FAB_BG : 'background.surface',
            color: item.primary ? '#fff' : 'text.primary',
            fontSize: 'sm', fontWeight: item.primary ? 'lg' : 'md',
            boxShadow: 'sm', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: 0.75,
          }}>
            {item.label}
            {item.soon && <Chip size='sm' variant='soft' color='neutral' sx={{ fontSize: '0.65rem', minHeight: 0, px: 0.75 }}>soon</Chip>}
          </Box>
        </Box>
      ))}
    </Box>

    {/* The FAB */}
    <Box
      role='button'
      aria-label='Big-AGI Operator'
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { gestureRef.current = null; setDragXY(null); }}
      onContextMenu={e => e.preventDefault()}
      sx={{
        position: 'fixed', zIndex: Z_FAB + 1,
        width: FAB_SIZE, height: FAB_SIZE, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: open ? FAB_BG_ACTIVE : FAB_BG,
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: dragXY ? '0 14px 32px rgba(0,0,0,0.45)' : '0 6px 18px rgba(0,0,0,0.35)',
        touchAction: 'none', userSelect: 'none', WebkitTapHighlightColor: 'transparent',
        cursor: dragXY ? 'grabbing' : 'pointer',
        transition: dragXY ? 'none' : 'left 0.2s, right 0.2s, bottom 0.2s, background-color 0.15s, box-shadow 0.15s',
        // status ring (listening / rambling / devices)
        '&::before': ringColor ? {
          content: '""', position: 'absolute', inset: -3, borderRadius: '50%',
          border: `2px solid ${ringColor}`,
          animation: `${ringPulse} 1.6s ease-out infinite`,
        } : undefined,
        '&::after': ringColor ? {
          content: '""', position: 'absolute', inset: -3, borderRadius: '50%',
          border: `2px solid ${ringColor}`,
        } : undefined,
      }}
      style={fabStyle}
    >
      {/* logo <-> close */}
      <BigAgiCircleIcon sx={{
        position: 'absolute', fontSize: '1.95rem', color: '#fff',
        opacity: open ? 0 : 1, transform: open ? 'rotate(-90deg) scale(0.6)' : 'none',
        transition: 'opacity 0.15s, transform 0.2s',
      }} />
      <CloseRoundedIcon sx={{
        position: 'absolute', fontSize: '1.75rem', color: '#fff',
        opacity: open ? 1 : 0, transform: open ? 'none' : 'rotate(90deg) scale(0.6)',
        transition: 'opacity 0.15s, transform 0.2s',
      }} />
    </Box>

    {/* Voice / command sheet */}
    {voiceOpen && <OperatorVoiceSheet onClose={() => setVoiceOpen(false)} />}

  </>;
}

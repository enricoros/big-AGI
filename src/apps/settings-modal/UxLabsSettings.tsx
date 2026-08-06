import * as React from 'react';

import { FormControl, Typography } from '@mui/joy';
import CodeIcon from '@mui/icons-material/Code';
import EditNoteIcon from '@mui/icons-material/EditNote';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import ShortcutIcon from '@mui/icons-material/Shortcut';
import SpeedIcon from '@mui/icons-material/Speed';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormSwitchControl } from '~/common/components/forms/FormSwitchControl';
import { Link } from '~/common/components/Link';
import { PhImageSquare } from '~/common/components/icons/phosphor/PhImageSquare';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useUXLabsStore } from '~/common/stores/store-ux-labs';


export function UxLabsSettings() {

  // external state
  const isMobile = useIsMobile();
  const {
    labsHighPerformance, setLabsHighPerformance,
    labsLosslessImages, setLabsPreserveLosslessImages,
    labsAutoHideComposer, setLabsAutoHideComposer,
    labsShowShortcutBar, setLabsShowShortcutBar,
    labsComposerAttachmentsInline, setLabsComposerAttachmentsInline,
    labsSingleDollarLatex, setLabsSingleDollarLatex,
  } = useUXLabsStore();

  return <>

    <FormSwitchControl
      title={<><PhImageSquare sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />Lossless Images</>} description={labsLosslessImages ? 'Large storage use' : 'Compress'}
      tooltipWarning={labsLosslessImages}
      tooltip={<>
        Preserves the original lossless PNG format for AI-generated images instead of compressing them to WebP/JPEG.
        <hr />
        WARNING: PNG images can be very large (e.g. 10-20MB each in high quality modes in Gemini Nano Banana models). This will use significantly more storage.
      </>}
      checked={labsLosslessImages} onChange={setLabsPreserveLosslessImages}
    />

    <FormSwitchControl
      title={<><SpeedIcon sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />Unlock Refresh</>} description={labsHighPerformance ? 'Unlocked' : 'Default'}
      tooltipWarning={labsHighPerformance}
      tooltip={<>
        Unlocks the maximum UI refresh rate for Chats and Beams, and will draw every single token as they come in.
        <hr />
        THIS MAY CAUSE HIGH CPU USAGE, BATTERY DRAIN, AND STUTTERING WITH FAST MODELS.
      </>}
      checked={labsHighPerformance} onChange={setLabsHighPerformance}
    />

    {!isMobile && <FormSwitchControl
      title={<><ShortcutIcon sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />Shortcuts Bar</>} description={labsShowShortcutBar ? 'Status Bar' : 'Disabled'}
      checked={labsShowShortcutBar} onChange={setLabsShowShortcutBar}
    />}

    <FormSwitchControl
      title={<><CodeIcon sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />Dollar Inline LaTeX</>} description={labsSingleDollarLatex ? 'Enabled' : 'Disabled'}
      tooltipWarning={labsSingleDollarLatex}
      tooltip={<>
        Renders single-dollar <code>$...$</code> as inline LaTeX math, in addition to the default <code>{'\\(...\\)'}</code> and <code>$$...$$</code> formats.
        <hr />
        WARNING: false positives are likely - currency like $10 or stock tickers like $AAPL may be incorrectly rendered as math.
      </>}
      checked={labsSingleDollarLatex} onChange={setLabsSingleDollarLatex}
    />

    <FormSwitchControl
      title={<><AttachFileRoundedIcon sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />Attachment Buttons</>} description={labsComposerAttachmentsInline ? 'Enabled' : 'Disabled'}
      checked={labsComposerAttachmentsInline} onChange={setLabsComposerAttachmentsInline}
    />

    <FormSwitchControl
      title={<><EditNoteIcon sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />Auto-hide input</>} description={labsAutoHideComposer ? 'Hover to show' : 'Always visible'}
      checked={labsAutoHideComposer} onChange={setLabsAutoHideComposer}
    />

    {/*
      Other Graduated (removed or backlog):
        - <Link href='https://github.com/enricoros/big-AGI/issues/359' target='_blank'>Draw App</Link>
        - Text Tools: dinamically shown where applicable (e.g. Diff)
        - Chat Mode: follow-ups; moved to Chat Advanced UI
    */}

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Graduated' description='Ex-labs' />
      <Typography level='body-xs'>
        Screen Capture · Webcam · Cost Estimation · Enhanced Code Blocks
        {' · '}<Link href='https://big-agi.com/blog/beam-multi-model-ai-reasoning' target='_blank'>Beam</Link>
        {' · '}<Link href='https://github.com/enricoros/big-AGI/issues/208' target='_blank'>Split Chats</Link>
        {' · '}<Link href='https://github.com/enricoros/big-AGI/issues/354' target='_blank'>Call AGI</Link>
        {' · '}<Link href='https://github.com/enricoros/big-AGI/issues/282' target='_blank'>Persona Creator</Link>
        {' · '}<Link href='https://github.com/enricoros/big-agi/issues/192' target='_blank'>Auto Diagrams</Link>
        {' · '}Imagine · Chat Search · Text Tools · LLM Overheat
      </Typography>
    </FormControl>

  </>;
}
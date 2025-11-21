import * as React from 'react';

import { Box, Button, Chip, List, ListItem, ListItemButton } from '@mui/joy';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TableViewRoundedIcon from '@mui/icons-material/TableView';

import { useScaledTypographySx } from '~/modules/blocks/blocks.styles';

import type { ContentScaling } from '~/common/app.theme';
import type { DVoidWebCitation } from '~/common/stores/chat/chat.fragments';
import type { Immutable } from '~/common/types/immutable.types';
import { AvatarDomainFavicon } from '~/common/components/AvatarDomainFavicon';
import { ExpanderControlledBox } from '~/common/components/ExpanderControlledBox';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { adjustContentScaling } from '~/common/app.theme';
import { copyToClipboard } from '~/common/util/clipboardUtils';
import { urlExtractDomain, urlPrettyHref } from '~/common/util/urlUtils';


// configuration
const MAX_ICONS = 6;
const COLOR = 'neutral';
const ENABLE_FAVICON_FIX_FOR_VERTEX = true; // Gemini returns links to VertexAiSearchCloud.com


function fixCitationUrl(url: string, title: string | undefined): string {
  if (!url) return '';
  if (ENABLE_FAVICON_FIX_FOR_VERTEX && url.startsWith('https://vertexaisearch') && title)
    return title;
  return url;
}


const _styles = {

  iconRowButton: {
    minHeight: '2.25rem',
    gap: 0.5,
    px: 1.5,
    border: 'none',
    transition: 'transform 0.14s ease',
    // '&:hover': { transform: 'translateY(-1px)' } as const,
  } as const,

  citationsList: {
    mt: 1,
    p: 0, // remove the list default padding
    boxShadow: `inset 1px 1px 3px -3px var(--joy-palette-${COLOR}-solidBg)`,
    borderRadius: 'sm',
    border: '1px solid',
    borderColor: `${COLOR}.outlinedBorder`,
    backgroundColor: `rgb(var(--joy-palette-${COLOR}-lightChannel) / 10%)`,
  } as const,

  citationItem: {
    // py: 0.75,
    gap: 1.5,
    borderRadius: 0,
    borderBottom: '1px solid',
    borderBottomColor: 'divider',
  } as const,

  citationItemLast: {
    // py: 0.75,
    gap: 1.5,
    border: 'none',
  } as const,

  citationNumber: {
    minWidth: 22,
    textAlign: 'end',
    // color: 'text.tertiary',
    // fontWeight: 'lg',
  } as const,

  line: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 1,
  } as const,

  lineContent: {
    display: 'grid',
    overflow: 'hidden',
  } as const,

  lineLink: {
    fontStyle: 'italic',
    fontSize: 'xs',
    opacity: 0.5,
  } as const,

} as const;


export function BlockPartModelAnnotations(props: {
  itemsName?: string;
  annotations: Immutable<DVoidWebCitation[]>;
  contentScaling: ContentScaling;
}) {

  // state
  const [expanded, setExpanded] = React.useState(false);

  // external state
  const adjustedScaling = adjustContentScaling(props.contentScaling, -1);
  const scaledTypographySx = useScaledTypographySx(adjustedScaling, false, false);

  // derived
  const annotationsCount = props.annotations.length;
  const moreIcons = annotationsCount - MAX_ICONS;

  const handleToggleExpanded = React.useCallback(() => setExpanded(on => !on), []);

  // useRef to keep current annotations for copy handlers
  const annotationsRef = React.useRef(props.annotations);
  annotationsRef.current = props.annotations;


  // copy handlers

  const handleCopyText = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    const citationsText = annotationsRef.current
      .map((citation, index) => {
        const domain = urlExtractDomain(citation.url);
        const refNumber = citation.refNumber ? `[${citation.refNumber}]` : `${index + 1}`;
        const title = citation.title || domain;
        const date = citation.pubTs ? ` (${new Date(citation.pubTs).toLocaleDateString()})` : '';
        return `${refNumber} ${title}${date}\n${citation.url}`;
      })
      .join('\n\n');
    copyToClipboard(citationsText, 'Citations');
  }, []);

  const handleCopyMarkdown = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    const markdownTable = [
      '| # | Title | URL | Date |',
      '|---|-------|-----|------|',
      ...annotationsRef.current.map((citation, index) => {
        const domain = urlExtractDomain(citation.url);
        const refNumber = citation.refNumber ? citation.refNumber : index + 1;
        const title = (citation.title || domain).replace(/\|/g, '\\|');
        const url = citation.url.replace(/\|/g, '\\|');
        const date = citation.pubTs ? new Date(citation.pubTs).toLocaleDateString() : '';
        return `| ${refNumber} | ${title} | ${url} | ${date} |`;
      })
    ].join('\n');
    copyToClipboard(markdownTable, 'Citations Table');
  }, []);

  // memo styles
  const scaledStyles = React.useMemo(() => ({
    iconRowButton: {
      ..._styles.iconRowButton,
      ...scaledTypographySx,
      // since we 'soft' on not expanded, inset it too
      ...(!expanded && { boxShadow: 'inset 1px 1px 4px -2px rgba(0, 0, 0, 0.2)' }),
    },
    citationsList: {
      ..._styles.citationsList,
      ...scaledTypographySx,
    }
  }), [expanded, scaledTypographySx]);

  if (!annotationsCount)
    return null;

  return (
    <Box
      sx={{ mx: 1.5 }}
    >

      {/* Row of favicons */}
      <Button
        size='sm'
        component='div'
        role='button'
        variant={!expanded ? 'soft' : 'plain'}
        color={COLOR}
        fullWidth
        aria-expanded={expanded}
        onClick={handleToggleExpanded}
        sx={scaledStyles.iconRowButton}
      >
        <span>{annotationsCount} {props.itemsName || 'citation'}{annotationsCount > 1 ? 's' : ''}</span>

        {/* Icons */}
        {!expanded && props.annotations.slice(0, MAX_ICONS).map((citation, index) => {
          const citationUrl = fixCitationUrl(citation.url, citation.title);
          return (
            <TooltipOutlined key={index} title={citation.title || urlExtractDomain(citationUrl)}>
              <div>
                <AvatarDomainFavicon key={index} url={citationUrl} size={18} iconRes={48} noHover noShadow />
              </div>
            </TooltipOutlined>
          );
        })}

        {/* +X symbol */}
        <span style={{ opacity: 0.5 }}>{(moreIcons >= 1 && !expanded) && '+' + moreIcons}</span>

        {/* Expand/Collapse button */}
        <Box sx={{
          ml: 'auto',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
        }}>

          {/* Copy buttons - only show when expanded */}
          {expanded && (
            <Chip
              size='sm'
              color={COLOR}
              variant='soft'
              onClick={handleCopyText}
              startDecorator={<ContentCopyIcon />}
              sx={{ px: 1.5 }}
            >
              Copy
            </Chip>
          )}
          {expanded && (
            <Chip
              size='sm'
              color={COLOR}
              variant='soft'
              onClick={handleCopyMarkdown}
              startDecorator={<TableViewRoundedIcon />}
              sx={{ px: 1.5 }}
            >
              Table
            </Chip>
          )}

          <ExpandMoreIcon
            sx={{
              ml: 'auto',
              transition: 'transform 0.14s ease',
              transform: expanded ? 'rotate(180deg)' : 'none',
            }}
          />
        </Box>
      </Button>

      {/* Expanded citations list */}
      <ExpanderControlledBox expanded={expanded}>

        <List sx={scaledStyles.citationsList}>
          {props.annotations.map((citation, index) => {
            const domain = urlExtractDomain(citation.url);

            return (
              <ListItem key={index}>
                <ListItemButton
                  component='a'
                  href={citation.url}
                  target='_blank'
                  rel='noopener noreferrer'
                  sx={index < annotationsCount - 1 ? _styles.citationItem : _styles.citationItemLast}
                >
                  <Box sx={_styles.citationNumber}>
                    {citation.refNumber ? `[${citation.refNumber}]` : index + 1}
                  </Box>

                  <Box sx={_styles.line}>
                    <AvatarDomainFavicon url={!expanded ? '' : fixCitationUrl(citation.url, citation.title)} size={24} iconRes={64} />
                    <Box sx={_styles.lineContent}>
                      <Box className='agi-ellipsize'>
                        {citation.title || domain}
                      </Box>
                      <Box sx={_styles.lineLink} className='agi-ellipsize'>
                        {urlPrettyHref(citation.url, true, true)}
                        {citation.pubTs && (
                          <span style={{ marginLeft: '0.5em' }}>
                            · {new Date(citation.pubTs).toLocaleDateString()}
                          </span>
                        )}
                      </Box>
                    </Box>
                  </Box>

                </ListItemButton>
              </ListItem>

            );
          })}
        </List>
      </ExpanderControlledBox>

    </Box>
  );
}

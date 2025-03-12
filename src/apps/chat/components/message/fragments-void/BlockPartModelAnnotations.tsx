import * as React from 'react';

import { Box, Button, List, ListItem, ListItemButton } from '@mui/joy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { useScaledTypographySx } from '~/modules/blocks/blocks.styles';

import type { ContentScaling } from '~/common/app.theme';
import type { DVoidWebCitation } from '~/common/stores/chat/chat.fragments';
import type { Immutable } from '~/common/types/immutable.types';
import { AvatarDomainFavicon } from '~/common/components/AvatarDomainFavicon';
import { ExpanderControlledBox } from '~/common/components/ExpanderControlledBox';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { urlExtractDomain, urlPrettyHref } from '~/common/util/urlUtils';


// configuration
const MAX_ICONS = 6;
const COLOR = 'neutral';


const styles = {

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
  const scaledTypographySx = useScaledTypographySx(props.contentScaling, false, false);

  // derived
  const annotationsCount = props.annotations.length;
  const moreIcons = annotationsCount - MAX_ICONS;

  const handleToggleExpanded = React.useCallback(() => setExpanded(on => !on), []);

  if (!annotationsCount)
    return null;

  return (
    <Box>

      {/* Row of favicons */}
      <Button
        size='sm'
        variant={expanded ? 'plain' : 'plain'}
        color={COLOR}
        fullWidth
        aria-expanded={expanded}
        onClick={handleToggleExpanded}
        sx={styles.iconRowButton}
      >
        <span>{annotationsCount} {props.itemsName || 'citation'}{annotationsCount > 1 ? 's' : ''}</span>

        {/* Icons */}
        {!expanded && props.annotations.slice(0, MAX_ICONS).map((citation, index) => (
          <TooltipOutlined key={index} title={citation.title || urlExtractDomain(citation.url)}>
            <div>
              <AvatarDomainFavicon key={index} url={citation.url} size={24} iconRes={48} noHover noShadow />
            </div>
          </TooltipOutlined>
        ))}

        {/* +X symbol */}
        {(moreIcons >= 1 && !expanded) && '+' + moreIcons}

        {/* Expand/Collapse button */}
        <ExpandMoreIcon
          sx={{
            ml: 'auto',
            transition: 'transform 0.14s ease',
            transform: expanded ? 'rotate(180deg)' : 'none',
          }}
        />
      </Button>

      {/* Expanded citations list */}
      <ExpanderControlledBox expanded={expanded}>

        <List sx={{ ...styles.citationsList, ...scaledTypographySx }}>
          {props.annotations.map((citation, index) => {
            const domain = urlExtractDomain(citation.url);

            return (
              <ListItem key={index}>
                <ListItemButton
                  component='a'
                  href={citation.url}
                  target='_blank'
                  rel='noopener noreferrer'
                  sx={index < annotationsCount - 1 ? styles.citationItem : styles.citationItemLast}
                >
                  <Box sx={styles.citationNumber}>
                    {citation.refNumber ? `[${citation.refNumber}]` : index + 1}
                  </Box>

                  <Box sx={styles.line}>
                    <AvatarDomainFavicon url={!expanded ? '' : citation.url} size={32} iconRes={64} />
                    <Box sx={styles.lineContent}>
                      <Box className='agi-ellipsize'>
                        {citation.title || domain}
                      </Box>
                      <Box sx={styles.lineLink} className='agi-ellipsize'>
                        {urlPrettyHref(citation.url, true, true)}
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

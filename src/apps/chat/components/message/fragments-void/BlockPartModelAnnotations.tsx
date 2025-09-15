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
import { adjustContentScaling } from '~/common/app.theme';
import { urlExtractDomain, urlPrettyHref } from '~/common/util/urlUtils';


// configuration
const MAX_ICONS = 6;
const COLOR = 'neutral';


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
    <Box>

      {/* Row of favicons */}
      <Button
        size='sm'
        variant={!expanded ? 'soft' : 'plain'}
        color={COLOR}
        fullWidth
        aria-expanded={expanded}
        onClick={handleToggleExpanded}
        sx={scaledStyles.iconRowButton}
      >
        <span>{annotationsCount} {props.itemsName || 'citation'}{annotationsCount > 1 ? 's' : ''}</span>

        {/* Icons */}
        {!expanded && props.annotations.slice(0, MAX_ICONS).map((citation, index) => (
          <TooltipOutlined key={index} title={citation.title || urlExtractDomain(citation.url)}>
            <div>
              <AvatarDomainFavicon key={index} url={citation.url} size={18} iconRes={48} noHover noShadow />
            </div>
          </TooltipOutlined>
        ))}

        {/* +X symbol */}
        <span style={{ opacity: 0.5 }}>{(moreIcons >= 1 && !expanded) && '+' + moreIcons}</span>

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
                    <AvatarDomainFavicon url={!expanded ? '' : citation.url} size={24} iconRes={64} />
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

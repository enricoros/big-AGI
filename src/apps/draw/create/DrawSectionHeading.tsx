import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { AspectRatio, Box, Card, CardOverflow, Chip, IconButton, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import FormatPaintTwoToneIcon from '@mui/icons-material/FormatPaintTwoTone';

import { animationShadowRingLimey } from '~/common/util/animUtils';


export function DrawSectionHeading(props: {
  title: React.ReactNode;
  isBeta?: boolean,
  subTitle: React.ReactNode;
  chipText: string | string[];
  highlight?: boolean,
  onRemoveHeading?: () => void,
  sx?: SxProps,
}) {

  return (

    <Card
      size='lg'
      variant='plain'
      orientation='horizontal'
      sx={{
        '--icon-size': { xs: '80px', md: '96px' },
        display: 'flex',
        flexFlow: 'row wrap',
        alignItems: 'center',
        gap: { xs: 3, md: 3 },
        ...props.sx,
      }}
    >

      {/* Left Draw Symbol */}
      <CardOverflow variant='solid' color='primary'>
        <AspectRatio
          ratio='1'
          variant='plain'
          color='primary'
          sx={{
            width: 'var(--icon-size)',
            m: 'auto',
            bgcolor: 'background.popup',
            borderRadius: '50%',
            boxShadow: 'sm',
            pointerEvents: 'none',
            transform: 'translateX(50%)',
            animation: props.highlight ? `${animationShadowRingLimey} 5s infinite` : undefined,
          }}
        >
          <div>
            <FormatPaintTwoToneIcon sx={{ fontSize: '3rem' }} />
          </div>
        </AspectRatio>
      </CardOverflow>

      {/* Messaging */}
      <Box sx={{
        flex: 1,
        pt: 0.5,
        ml: 'calc(var(--icon-size) / 2)',
        position: 'relative',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'start' }}>
          <Typography level='title-lg'>
            {props.title}
          </Typography>
          {props.isBeta && (
            <Chip variant='solid' size='sm' sx={{ ml: 1, fontSize: '' }}>
              beta
            </Chip>
          )}
        </Box>
        <Typography level='title-sm' sx={{ mt: 1 }}>
          {props.subTitle}
        </Typography>
        <Box>
          {Array.isArray(props.chipText) ? props.chipText.map((text, i) => (
            <Chip key={i} variant='outlined' size='sm' sx={{ px: 1, py: 0.5, mt: 0.5, ml: !i ? -1 : -0.5, textWrap: 'wrap' }}>
              {text}
            </Chip>
          )) : (!!props.chipText?.trim()) && (
            <Chip variant='outlined' size='sm' sx={{ px: 1, py: 0.5, mt: 0.5, ml: -1, textWrap: 'wrap' }}>
              {props.chipText}
            </Chip>
          )}
        </Box>

        {/* Close button */}
        {!!props.onRemoveHeading && (
          <IconButton
            variant='plain'
            color='neutral'
            onClick={props.onRemoveHeading}
            sx={{
              position: 'absolute',
              top: -2,
              right: -4,
              zIndex: 1,
            }}>
            <CloseRoundedIcon />
          </IconButton>
        )}
      </Box>

      {/* Section Selector*/}
      {/*{props.showSections && (*/}
      {/*  <Divider sx={{ flex: 1 }}>*/}

      {/*    <ButtonGroup*/}
      {/*      // color='primary'*/}
      {/*      size='sm'*/}
      {/*      orientation='horizontal'*/}
      {/*      sx={{*/}
      {/*        mx: 'auto',*/}
      {/*        backgroundColor: 'background.surface',*/}
      {/*        boxShadow: 'sm',*/}
      {/*        '& > button': {*/}
      {/*          minWidth: 104,*/}
      {/*        },*/}
      {/*      }}*/}
      {/*    >*/}
      {/*      <Button*/}
      {/*        variant={props.section === 0 ? 'solid' : 'plain'}*/}
      {/*        onClick={() => props.setSection(0)}*/}
      {/*      >*/}
      {/*        Generate*/}
      {/*      </Button>*/}
      {/*      <Button*/}
      {/*        disabled*/}
      {/*        variant={props.section === 1 ? 'solid' : 'plain'}*/}
      {/*        onClick={() => props.setSection(1)}*/}
      {/*      >*/}
      {/*        Refine*/}
      {/*      </Button>*/}
      {/*      /!*<Button*!/*/}
      {/*      /!*  disabled*!/*/}
      {/*      /!*  variant={props.section === 2 ? 'solid' : 'plain'}*!/*/}
      {/*      /!*  onClick={() => props.setSection(1)}*!/*/}
      {/*      /!*>*!/*/}
      {/*      /!*  Gallery*!/*/}
      {/*      /!*</Button>*!/*/}
      {/*    </ButtonGroup>*/}

      {/*  </Divider>*/}
      {/*)}*/}

    </Card>
  );
}
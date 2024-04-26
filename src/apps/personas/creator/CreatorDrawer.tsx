import * as React from 'react';

import { Box, Button, IconButton, ListItemDecorator, Sheet, Tooltip } from '@mui/joy';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Diversity2Icon from '@mui/icons-material/Diversity2';
import DoneIcon from '@mui/icons-material/Done';

import { PageDrawerHeader } from '~/common/layout/optima/components/PageDrawerHeader';
import { PageDrawerList } from '~/common/layout/optima/components/PageDrawerList';
import { useOptimaDrawers } from '~/common/layout/optima/useOptimaDrawers';

import { CreatorDrawerItem } from './CreatorDrawerItem';
import { deleteSimplePersona, deleteSimplePersonas, useSimplePersonas } from '../store-app-personas';


export function CreatorDrawer(props: {
  selectedSimplePersonaId: string | null,
  setSelectedSimplePersonaId: (simplePersonaId: string | null) => void,
}) {

  // selection mode
  const [selectMode, setSelectMode] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // external state
  const { closeDrawer } = useOptimaDrawers();
  const { simplePersonas } = useSimplePersonas();


  // derived state
  const hasPersonas = simplePersonas.length > 0;


  // Simple Persona Operations

  const { setSelectedSimplePersonaId } = props;

  const handleSimplePersonaUnselect = React.useCallback(() => {
    setSelectedSimplePersonaId(null);
  }, [setSelectedSimplePersonaId]);

  const handleSimplePersonaDelete = React.useCallback((simplePersonaId: string) => {
    deleteSimplePersona(simplePersonaId);
    handleSimplePersonaUnselect();
  }, [handleSimplePersonaUnselect]);


  // Selection

  const handleSelectionClose = React.useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleSelectionToggleId = React.useCallback((simplePersonaId: string) => {
    setSelectedIds(prevSelectedIds => {
      const newSelectedItems = new Set(prevSelectedIds);
      if (newSelectedItems.has(simplePersonaId))
        newSelectedItems.delete(simplePersonaId);
      else
        newSelectedItems.add(simplePersonaId);
      return newSelectedItems;
    });
  }, []);

  const handleSelectionInvert = React.useCallback(() => {
    setSelectedIds(prevSelectedIds => {
      const newSelectedIds = new Set(prevSelectedIds);
      simplePersonas.forEach(persona => {
        if (newSelectedIds.has(persona.id))
          newSelectedIds.delete(persona.id);
        else
          newSelectedIds.add(persona.id);
      });
      return newSelectedIds;
    });
  }, [simplePersonas]);

  const handleSelectionDelete = React.useCallback(() => {
    deleteSimplePersonas(selectedIds);
    setSelectedIds(new Set());
  }, [selectedIds]);


  return <>

    {/* Drawer Header */}
    <PageDrawerHeader
      title={selectMode ? 'Selection Mode' : 'Recent'}
      onClose={selectMode ? handleSelectionClose : closeDrawer}
    >
      {hasPersonas && !selectMode && (
        <Tooltip title={selectMode ? 'Done' : 'Select'}>
          <IconButton onClick={selectMode ? handleSelectionClose : () => setSelectMode(true)}>
            {selectMode ? <DoneIcon /> : <CheckBoxOutlineBlankIcon />}
          </IconButton>
        </Tooltip>
      )}
    </PageDrawerHeader>

    <PageDrawerList
      variant='plain'
      noTopPadding noBottomPadding tallRows
      onClick={handleSimplePersonaUnselect}
    >

      {selectMode ? (
        // Selection Header
        <Sheet variant='soft' color='warning' invertedColors>
          <Box sx={{ display: 'flex', alignItems: 'center', px: 1, minHeight: '3rem' }}>
            <Button
              variant='plain'
              color='warning'
              startDecorator={selectedIds.size === simplePersonas.length ? <CheckBoxOutlineBlankIcon /> : <CheckBoxIcon />}
              onClick={handleSelectionInvert}
            >
              {selectedIds.size === simplePersonas.length
                ? 'Select None'
                : selectedIds.size === 0
                  ? `Select ${simplePersonas.length.toLocaleString() || 'All'}`
                  : 'Invert'}
            </Button>
            <Button
              variant='solid'
              color='warning'
              startDecorator={<DeleteOutlineIcon />}
              onClick={handleSelectionDelete}
              disabled={selectedIds.size === 0}
              sx={{ ml: 'auto' }}
            >
              Delete
            </Button>
          </Box>
        </Sheet>
      ) : (
        // Create Button
        <Button
          variant={props.selectedSimplePersonaId ? 'plain' : 'soft'}
          onClick={handleSimplePersonaUnselect}
          sx={{
            m: 2,

            // ...PageDrawerTallItemSx,
            justifyContent: 'flex-start',
            padding: '0px 0.75rem',

            // style
            border: '1px solid',
            borderColor: 'neutral.outlinedBorder',
            borderRadius: 'sm',
            '--ListItemDecorator-size': 'calc(2.5rem - 1px)', // compensate for the border
          }}
        >
          <ListItemDecorator><Diversity2Icon /></ListItemDecorator>
          {/*<Typography level='title-sm' sx={!props.selectedSimplePersonaId ? { fontWeight: 'lg' } : undefined}>*/}
          Create
          {/*</Typography>*/}
        </Button>
      )}

      {/* Personas [] */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {simplePersonas.map(item =>
          <CreatorDrawerItem
            key={item.id}
            item={item}
            isActive={item.id === props.selectedSimplePersonaId}
            isSelected={selectedIds.has(item.id)}
            isSelection={selectMode}
            onClick={(event) => {
              event.stopPropagation();
              if (selectMode)
                handleSelectionToggleId(item.id);
              else
                props.setSelectedSimplePersonaId(item.id);
            }}
            onDelete={handleSimplePersonaDelete}
          />,
        )}
      </Box>

    </PageDrawerList>

  </>;
}
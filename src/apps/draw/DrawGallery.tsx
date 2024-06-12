import * as React from 'react';

import { AppPlaceholder } from '../AppPlaceholder';
import { useDBlobItemsByTypeCIdSId } from '~/modules/dblobs/dblobs.hooks';
import { DBlobImageItem, DBlobMetaDataType } from '~/modules/dblobs/dblobs.types';
import { Box, Table } from '@mui/joy';


export function DrawGallery(props: { domain: 'draw' | 'app' }) {

  // external state from the DB
  const [items] = useDBlobItemsByTypeCIdSId<DBlobImageItem>(
    DBlobMetaDataType.IMAGE,
    'global',
    props.domain === 'draw' ? 'app-draw' : 'app-chat',
  );

  // wait until we load everything
  if (!items || items.length === 0) {
    return (
      <AppPlaceholder text={items === undefined ? 'Loading...' : 'No images found.'} />
    );
  }

  return (
    <Box sx={{
      flexGrow: 1,
      overflowY: 'auto',
      p: { xs: 3, md: 6 },
      border: '1px solid blue',
    }}>

      <Table
        borderAxis='both'
        size='sm'
        // stickyHeader
        stripe='odd'
        variant='plain'
      >
        <thead>
        <tr>
          <th>ID</th>
          <th>Label</th>
          <th>Origin</th>
          <th>Metadata</th>
        </tr>
        </thead>
        <tbody>
        {items.map((_item) => {
          const {
            id,
            label,
            data,
            origin,
            metadata,
            createdAt,
            updatedAt,
          } = _item;
          return (
            <tr key={id}>
              <td>
                <picture style={{ display: 'flex', maxWidth: 256, maxHeight: 256 }}>
                  <img src={`data:${data.mimeType};base64,${data.base64}`} alt={label} style={{ maxWidth: '100%', maxHeight: '100%' }} />
                </picture>
              </td>
              <td>{label}</td>
              <td>
                <Box sx={{
                  overflowWrap: 'anywhere',
                  whiteSpace: 'break-spaces',
                }}>
                  {JSON.stringify(origin, null, 2)}
                </Box>
              </td>
              <td>
                <Box sx={{
                  overflowWrap: 'anywhere',
                  whiteSpace: 'break-spaces',
                }}>
                  {JSON.stringify(metadata, null, 2)}
                  <br />
                  {createdAt ? new Date(createdAt).toLocaleString() : 'no creation'}
                  <br />
                  {(updatedAt && updatedAt !== createdAt) ? new Date(updatedAt).toLocaleString() : null}
                </Box>
              </td>
            </tr>
          );
        })}
        </tbody>
      </Table>

    </Box>
  );
}
import * as React from 'react';
import { Box, Table } from '@mui/joy';

import { DBlobAssetType, DBlobImageAsset } from '~/modules/dblobs/dblobs.types';
import { useDBAssetsByScopeAndType } from '~/modules/dblobs/dblobs.hooks';

import { ZeroGallery } from './gallery/ZeroGallery';


export function DrawGallery(props: { domain: 'draw' | 'app' }) {
  const [items] = useDBAssetsByScopeAndType<DBlobImageAsset>(
    DBlobAssetType.IMAGE,
    'global',
    props.domain === 'draw' ? 'app-draw' : 'app-chat',
  );


  const boxStyles = {
    flexGrow: 1,
    overflowY: 'auto',
    p: { xs: 2, md: 6 },
  };

  const cellStyles = {
    overflowWrap: 'anywhere',
    whiteSpace: 'break-spaces',
  };

  return (
    <Box sx={boxStyles}>
      <Table borderAxis='both' size='sm' stripe='odd' variant='plain'>
        <thead>
        <tr>
          <th>Image</th>
          <th>Origin</th>
          <th>Metadata</th>
        </tr>
        </thead>
        <tbody>
        {(items || []).map(({ id, label, cache, data, origin, metadata, createdAt, updatedAt }) => (
          <tr key={id}>
            <td>
              <Box sx={cellStyles}>
                <picture style={{ display: 'flex', maxWidth: 256, maxHeight: 256 }}>
                  <img
                    src={cache.thumb256?.base64 ? `data:${cache.thumb256?.mimeType};base64,${cache.thumb256?.base64}` : `data:${data.mimeType};base64,${data.base64}`}
                    alt={label}
                    style={{
                      boxShadow: '0 0 4px 1px rgba(0, 0, 0, 0.1)',
                      maxWidth: '100%',
                      maxHeight: '100%',
                      opacity: cache.thumb256?.base64 ? 1 : 0.5,
                    }}
                  />
                </picture>
                {label}
              </Box>
            </td>
            <td>
              <Box sx={cellStyles}>{JSON.stringify(origin, null, 2)}</Box>
            </td>
            <td>
              <Box sx={cellStyles}>
                {JSON.stringify(metadata, null, 2)}
                <br />
                {createdAt ? new Date(createdAt).toLocaleString() : 'no creation'}
                <br />
                {updatedAt && updatedAt !== createdAt ? new Date(updatedAt).toLocaleString() : null}
              </Box>
            </td>
          </tr>
        ))}
        </tbody>
      </Table>
      {(!items || items.length === 0) && <ZeroGallery domain={props.domain} />}
    </Box>
  );
}
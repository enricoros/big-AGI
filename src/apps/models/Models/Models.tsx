import * as React from 'react';
import { getModels } from '@/modules/openai/openai.client';

export function Models(props: any) {
  React.useEffect(() => {
    getModels().then((models) => {
      console.log('models', models);
    });
  }, []);
  return <></>;
}

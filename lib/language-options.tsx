import * as React from 'react';

import { Option } from '@mui/joy';

import languages from './languages.json' assert { type: 'json' };

export const languageOptions: React.ReactNode[] = Object.entries(languages).map(([language, localesOrCode]) =>
  typeof localesOrCode === 'string'
    ? (
      <Option key={localesOrCode} value={localesOrCode}>
        {language}
      </Option>
    ) : (
      Object.entries(localesOrCode).map(([country, code]) => (
        <Option key={code} value={code}>
          {`${language} (${country})`}
        </Option>
      ))
    ));

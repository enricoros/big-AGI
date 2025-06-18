import * as React from 'react';
import { Typography } from '@mui/joy';

// Assuming ZhipuAIAccessSchema is defined in zhipuai.vendor.ts or a .types file
// For this component, we don't strictly need it if it's just informational.
// import type { ZhipuAIAccessSchema } from './zhipuai.vendor';

export function ZhipuAIServiceSetup(
  { /* vendorId, access, onEditAccess */ }: {
    // vendorId: ModelVendorId | 'zhipuai'; // To make it specific if needed
    // access: DeepPartial<ZhipuAIAccessSchema>;
    // onEditAccess: (access: DeepPartial<ZhipuAIAccessSchema>) => void;
  }
) {
  return (
    <Typography level="body-sm">
      ZhipuAI models are available for use.
      The API key is centrally managed for this version.
      {/* Future: allow user-provided API key input here */}
    </Typography>
  );
}

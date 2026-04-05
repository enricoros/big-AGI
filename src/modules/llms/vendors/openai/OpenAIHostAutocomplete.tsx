import * as React from 'react';

import { Autocomplete, AutocompleteOption, Box, FormControl, FormHelperText, FormLabel, ListItemDecorator, Typography } from '@mui/joy';
import InfoIcon from '@mui/icons-material/Info';

import { GoodTooltip } from '~/common/components/GoodTooltip';
import { Link } from '~/common/components/Link';

import { ArceeAIIcon } from '~/common/components/icons/vendors/ArceeAIIcon';
import { ChutesAIIcon } from '~/common/components/icons/vendors/ChutesAIIcon';
import { FireworksAIIcon } from '~/common/components/icons/vendors/FireworksAIIcon';
import { CloudflareIcon } from '~/common/components/icons/vendors/CloudflareIcon';
import { HeliconeIcon } from '~/common/components/icons/vendors/HeliconeIcon';
import { MiniMaxIcon } from '~/common/components/icons/vendors/MiniMaxIcon';
import { NovitaAIIcon } from '~/common/components/icons/vendors/NovitaAIIcon';


/**
 * Normalizes a host URL by stripping trailing /v1 or /v1/ suffix.
 * Server-side OPENAI_API_PATHS, uses /v1/ for all paths, so we don't repeat it here.
 */
function normalizeHostStripV1Suffix(host: string): string {
  return host.replace(/\/v1\/?$/, '');
}


// Verified OpenAI-compatible providers that work with the 'openai' dialect
interface VerifiedProvider {
  id: string;
  label: string;
  host: string;
  description: string;
  category: 'Example Proxies' | 'Example Providers';
  docsUrl?: string; // optional link to provider docs
  hostMatch?: string; // substring to match against current host (defaults to host)
  icon?: React.ComponentType<{ sx?: object }>; // optional icon component
}

const OPENAI_COMPATIBLE_PROVIDERS: VerifiedProvider[] = [
  // Example Providers
  { id: 'arcee', label: 'Arcee AI', host: 'https://api.arcee.ai/api', hostMatch: 'arcee.ai', category: 'Example Providers', description: 'Open-weight MoE models', docsUrl: 'https://docs.arcee.ai/', icon: ArceeAIIcon },
  { id: 'chutes', label: 'Chutes AI', host: 'https://llm.chutes.ai', hostMatch: '.chutes.ai', category: 'Example Providers', description: 'Serverless open model inference', docsUrl: 'https://chutes.ai/docs', icon: ChutesAIIcon },
  { id: 'fireworks', label: 'Fireworks AI', host: 'https://api.fireworks.ai/inference', hostMatch: 'fireworks.ai', category: 'Example Providers', description: 'Fast open model inference', docsUrl: 'https://docs.fireworks.ai/getting-started/quickstart', icon: FireworksAIIcon },
  { id: 'llmapi', label: 'LLM API', host: 'https://api.llmapi.ai', hostMatch: 'llmapi.ai', category: 'Example Providers', description: 'Multi-provider API gateway', docsUrl: 'https://llmapi.ai' },
  { id: 'minimax', label: 'MiniMax', host: 'https://api.minimax.io', hostMatch: 'minimax.io', category: 'Example Providers', description: 'Proprietary reasoning models', docsUrl: 'https://platform.minimax.io/docs', icon: MiniMaxIcon },
  { id: 'novita', label: 'Novita AI', host: 'https://api.novita.ai/openai', hostMatch: 'novita.ai', category: 'Example Providers', description: 'Budget open model inference', docsUrl: 'https://novita.ai/docs', icon: NovitaAIIcon },
  // Example Proxies
  { id: 'helicone', label: 'Helicone', host: 'https://oai.hconeai.com', hostMatch: 'hconeai.com', category: 'Example Proxies', description: 'Observability and caching proxy', docsUrl: 'https://docs.helicone.ai/getting-started/quick-start', icon: HeliconeIcon },
  { id: 'cloudflare', label: 'Cloudflare AI Gateway', host: 'https://gateway.ai.cloudflare.com/v1/{account}/{gateway}/openai', hostMatch: 'gateway.ai.cloudflare.com', category: 'Example Proxies', description: 'Caching and analytics gateway', docsUrl: 'https://developers.cloudflare.com/ai-gateway/', icon: CloudflareIcon },
];

// Find matching provider based on current host value
export function findMatchingOpenAIAutoProvider(host: string): VerifiedProvider | undefined {
  if (!host) return undefined;
  return OPENAI_COMPATIBLE_PROVIDERS.find(p =>
    host.includes(p.hostMatch ?? p.host),
  );
}


// Autocomplete component for selecting verified OpenAI-compatible providers or typing custom URLs

export function OpenAIHostAutocomplete(props: {
  value: string;
  onChange: (value: string) => void;
}) {

  // local input state for freeSolo
  const [inputValue, setInputValue] = React.useState(props.value ?? '');

  // derived state
  const matchedProvider = findMatchingOpenAIAutoProvider(props.value);

  // sync input when value prop changes externally
  React.useEffect(() => {
    setInputValue(props.value ?? '');
  }, [props.value]);

  // handlers
  const handleChange = React.useCallback((_event: unknown, newValue: string | VerifiedProvider | null) => {
    // newValue can be: string (typed), VerifiedProvider (selected), or null (cleared)
    if (newValue === null)
      props.onChange('');
    else if (typeof newValue === 'string')
      props.onChange(normalizeHostStripV1Suffix(newValue));
    else
      props.onChange(newValue.host);
  }, [props]);

  const handleInputChange = React.useCallback((_event: unknown, newInputValue: string, reason: string) => {
    // Only update on user input, not on programmatic changes
    if (reason !== 'input')
      return;

    // strip /v1 suffix immediately - gives user clear feedback that it's not needed
    newInputValue = normalizeHostStripV1Suffix(newInputValue);
    setInputValue(newInputValue);
    props.onChange(newInputValue);
  }, [props]);

  // dynamic right label: show docs link when a provider is matched
  const rightLabel = matchedProvider?.docsUrl
    ? <Link level='body-sm' href={matchedProvider.docsUrl} target='_blank'>{matchedProvider.label} docs</Link>
    : null;

  return (
    <FormControl>
      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <FormLabel sx={{ flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
          API Endpoint
          <GoodTooltip title={`An OpenAI compatible endpoint to be used in place of 'api.openai.com'.\n\nSelect a verified provider from the list, or type any custom URL.`} arrow placement='top'>
            <InfoIcon sx={{ ml: 0.5, cursor: 'pointer', fontSize: 'md', color: 'primary.solidBg' }} />
          </GoodTooltip>
        </FormLabel>
        {rightLabel && <FormHelperText sx={{ display: 'block' }}>{rightLabel}</FormHelperText>}
      </Box>
      <Autocomplete<VerifiedProvider, false, false, true>
        freeSolo
        openOnFocus
        clearOnEscape
        placeholder='Select or type endpoint...'
        options={OPENAI_COMPATIBLE_PROVIDERS}
        groupBy={(option) => option.category}
        getOptionKey={(option) => typeof option === 'string' ? option : option.id}
        getOptionLabel={(option) => typeof option === 'string' ? option : option.host}
        isOptionEqualToValue={(option, val) => option.host === (typeof val === 'string' ? val : val.host)}
        value={OPENAI_COMPATIBLE_PROVIDERS.find(p => p.host === props.value) ?? (props.value || null)}
        onChange={handleChange}
        inputValue={inputValue}
        onInputChange={handleInputChange}
        renderGroup={(params) => (
          <Box component='li' key={params.key}>
            <Typography level='body-sm' sx={{ textAlign: 'center', my: 1 }}>
              {params.group}
            </Typography>
            <Box component='ul' sx={{ p: 0 }}>
              {params.children}
            </Box>
          </Box>
        )}
        renderOption={(optionProps, option) => {
          const { key, ...rest } = optionProps as any;
          return (
            <AutocompleteOption key={key} {...rest} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
              <ListItemDecorator>{option.icon && <option.icon />}</ListItemDecorator>
              <Box sx={{ minWidth: 0 }}>
                <Typography level='title-sm'>{option.label}</Typography>
                <Typography level='body-xs' textColor='text.tertiary' className='agi-ellipsize' mt={0.25}>{option.description}</Typography>
              </Box>
            </AutocompleteOption>
          );
        }}
        slotProps={{
          root: {
            sx: { boxShadow: 'none' },
          },
          listbox: {
            sx: {
              maxWidth: 'min(450px, calc(100dvw - 1rem))',
              // // Add footer hint
              // '&::after': {
              //   content: '"Or type any OpenAI-compatible base URL"',
              //   display: 'block',
              //   p: 1.5,
              //   color: 'text.tertiary',
              //   fontSize: 'xs',
              //   fontStyle: 'italic',
              //   borderTop: '1px solid',
              //   borderColor: 'divider',
              // },
            },
          },
        }}
      />
    </FormControl>
  );
}

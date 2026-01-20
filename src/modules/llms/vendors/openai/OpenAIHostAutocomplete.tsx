import * as React from 'react';

import { Autocomplete, AutocompleteOption, Box, FormControl, FormHelperText, FormLabel, Typography } from '@mui/joy';
import InfoIcon from '@mui/icons-material/Info';

import { GoodTooltip } from '~/common/components/GoodTooltip';
import { Link } from '~/common/components/Link';


// Verified OpenAI-compatible providers that work with the 'openai' dialect
interface VerifiedProvider {
  id: string;
  label: string;
  host: string;
  description: string;
  category: 'Example Proxies' | 'Example Providers';
  docsUrl?: string; // optional link to provider docs
  hostMatch?: string; // substring to match against current host (defaults to host)
}

const OPENAI_COMPATIBLE_PROVIDERS: VerifiedProvider[] = [
  // Example Providers
  { id: 'chutes', label: 'Chutes AI', host: 'https://llm.chutes.ai', hostMatch: '.chutes.ai', category: 'Example Providers', description: 'GPU marketplace for AI inference', docsUrl: 'https://chutes.ai/docs' },
  { id: 'fireworks', label: 'Fireworks AI', host: 'https://api.fireworks.ai/inference', hostMatch: 'fireworks.ai', category: 'Example Providers', description: 'Fast inference for open models', docsUrl: 'https://docs.fireworks.ai/getting-started/quickstart' },
  { id: 'novita', label: 'Novita AI', host: 'https://api.novita.ai/openai', hostMatch: 'novita.ai', category: 'Example Providers', description: 'OpenAI-compatible inference', docsUrl: 'https://novita.ai/docs' },
  // Example Proxies
  { id: 'helicone', label: 'Helicone', host: 'https://oai.hconeai.com', hostMatch: 'hconeai.com', category: 'Example Proxies', description: 'OpenAI observability and caching proxy', docsUrl: 'https://docs.helicone.ai/getting-started/quick-start' },
  { id: 'cloudflare', label: 'Cloudflare AI Gateway', host: 'https://gateway.ai.cloudflare.com/v1/{account}/{gateway}/openai', hostMatch: 'gateway.ai.cloudflare.com', category: 'Example Proxies', description: 'AI Gateway with caching and analytics', docsUrl: 'https://developers.cloudflare.com/ai-gateway/' },
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
      props.onChange(newValue);
    else
      props.onChange(newValue.host);
  }, [props]);

  const handleInputChange = React.useCallback((_event: unknown, newInputValue: string, reason: string) => {
    // Only update on user input, not on programmatic changes
    if (reason !== 'input')
      return;
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
            <AutocompleteOption key={key} {...rest} sx={{ display: 'block', py: 1 }}>
              <Typography level='title-sm'>{option.label}</Typography>
              <Typography level='body-xs' textColor='text.tertiary' className='agi-ellipsize' mt={0.25}>{option.description}</Typography>
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

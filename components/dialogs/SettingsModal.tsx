import * as React from 'react';
import { shallow } from 'zustand/shallow';

import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  IconButton,
  Input,
  Modal,
  ModalClose,
  ModalDialog,
  ModalOverflow,
  Option,
  Radio,
  RadioGroup,
  Select,
  Slider,
  Stack,
  Switch,
  Typography,
} from '@mui/joy';
import KeyIcon from '@mui/icons-material/Key';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import WidthNormalIcon from '@mui/icons-material/WidthNormal';
import WidthWideIcon from '@mui/icons-material/WidthWide';

import { Link } from '@/components/util/Link';
import { useSettingsStore } from '@/lib/store-settings';

export const isValidOpenAIApiKey = (apiKey?: string) => !!apiKey && apiKey.startsWith('sk-') && apiKey.length > 40;

export function Section(props: { title?: string; collapsible?: boolean; collapsed?: boolean; disclaimer?: string; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(props.collapsed ?? false);

  return (
    <>
      <Stack direction="row" sx={{ mt: props.title ? 1 : 0, alignItems: 'center' }}>
        {!!props.title && <FormLabel>{props.title}</FormLabel>}
        {!!props.collapsible && (
          <IconButton size="sm" variant="plain" color="neutral" onClick={() => setCollapsed(!collapsed)}>
            {!collapsed ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        )}
      </Stack>

      {!collapsed && <Box sx={{ mt: 1.5, mb: 1.5 }}>{props.children}</Box>}

      {!!props.disclaimer && <FormHelperText>{props.disclaimer}</FormHelperText>}
    </>
  );
}

/**
 * Component that allows the User to modify the application settings,
 * persisted on the client via localStorage.
 *
 * @param {boolean} open Whether the Settings modal is open
 * @param {() => void} onClose Call this to close the dialog from outside
 */
export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  // external state
  const {
    centerMode,
    setCenterMode,
    renderMarkdown,
    setRenderMarkdown,
    showPurposeFinder,
    setShowPurposeFinder,
    zenMode,
    setZenMode,
    apiKey,
    setApiKey,
    apiHost,
    setApiHost,
    apiOrganizationId,
    setApiOrganizationId,
    modelTemperature,
    setModelTemperature,
    modelMaxResponseTokens,
    setModelMaxResponseTokens,
    textToSpeechLang,
    setTextToSpeechLang,
  } = useSettingsStore((state) => state, shallow);

  const handleCenterModeChange = (event: React.ChangeEvent<HTMLInputElement>) => setCenterMode((event.target.value as 'narrow' | 'wide' | 'full') || 'wide');

  const handleRenderMarkdownChange = (event: React.ChangeEvent<HTMLInputElement>) => setRenderMarkdown(event.target.checked);

  const handleShowSearchBarChange = (event: React.ChangeEvent<HTMLInputElement>) => setShowPurposeFinder(event.target.checked);

  const handleZenModeChange = (event: React.ChangeEvent<HTMLInputElement>) => setZenMode(event.target.value as 'clean' | 'cleaner');

  const handleApiKeyChange = (e: React.ChangeEvent) => setApiKey((e.target as HTMLInputElement).value);

  const handleApiKeyDown = (e: React.KeyboardEvent) => e.key === 'Enter' && onClose();

  const handleApiHostChange = (e: React.ChangeEvent) => setApiHost((e.target as HTMLInputElement).value);

  const handleApiOrganizationIdChange = (e: React.ChangeEvent) => setApiOrganizationId((e.target as HTMLInputElement).value);

  const handleTemperatureChange = (event: Event, newValue: number | number[]) => setModelTemperature(newValue as number);

  const handleMaxTokensChange = (event: Event, newValue: number | number[]) => setModelMaxResponseTokens(newValue as number);

  const handleTextToSpeechLangChange = (event: Event, newValue: string) => {
    setTextToSpeechLang(newValue as string);
    window.location.reload();
  };

  const needsApiKey = !!process.env.REQUIRE_USER_API_KEYS;
  const isValidKey = isValidOpenAIApiKey(apiKey);

  const hideOnMobile = { display: { xs: 'none', md: 'flex' } };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalOverflow>
        <ModalDialog sx={{ maxWidth: 500, display: 'flex', p: { xs: 1, sm: 2, lg: '20px' } }}>
          <ModalClose />

          <Typography level="h5" sx={{ mb: 2 }}>
            Settings
          </Typography>

          <Section>
            <FormControl>
              <FormLabel>OpenAI API Key {needsApiKey ? '' : '(optional)'}</FormLabel>
              <Input
                variant="outlined"
                type="password"
                placeholder={needsApiKey ? 'required' : 'sk-...'}
                error={needsApiKey && !isValidKey}
                value={apiKey}
                onChange={handleApiKeyChange}
                onKeyDown={handleApiKeyDown}
                startDecorator={<KeyIcon />}
              />
              <FormHelperText sx={{ display: 'block', lineHeight: 1.75 }}>
                {needsApiKey ? (
                  <>
                    <Link level="body2" href="https://platform.openai.com/account/api-keys" target="_blank">
                      Create Key
                    </Link>
                    , then apply to the{' '}
                    <Link level="body2" href="https://openai.com/waitlist/gpt-4-api" target="_blank">
                      GPT-4 waitlist
                    </Link>
                  </>
                ) : (
                  `This key will take precedence over the server's.`
                )}{' '}
                <Link level="body2" href="https://platform.openai.com/account/usage" target="_blank">
                  Check usage here
                </Link>
                .
              </FormHelperText>
            </FormControl>
          </Section>

          <Section>
            <Stack direction="column" sx={{ gap: 3, maxWidth: 400 }}>
              <FormControl orientation="horizontal" sx={{ ...hideOnMobile, alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <FormLabel>Centering</FormLabel>
                  <FormHelperText>{centerMode === 'full' ? 'Full screen' : centerMode === 'narrow' ? 'Narrow' : 'Wide'} chat</FormHelperText>
                </Box>
                <RadioGroup orientation="horizontal" value={centerMode} onChange={handleCenterModeChange}>
                  <Radio value="narrow" label={<WidthNormalIcon sx={{ width: 25, height: 24, mt: -0.25 }} />} />
                  <Radio value="wide" label={<WidthWideIcon sx={{ width: 25, height: 24, mt: -0.25 }} />} />
                  <Radio value="full" label="Full" />
                </RadioGroup>
              </FormControl>

              <FormControl orientation="horizontal" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <FormLabel>Visual Clutter</FormLabel>
                  <FormHelperText>{zenMode === 'clean' ? 'Show senders' : 'Hide sender and menus'}</FormHelperText>
                </Box>
                <RadioGroup orientation="horizontal" value={zenMode} onChange={handleZenModeChange}>
                  {/*<Radio value='clean' label={<Face6Icon sx={{ width: 24, height: 24, mt: -0.25 }} />} />*/}
                  <Radio value="clean" label="Clean" />
                  <Radio value="cleaner" label="Empty" />
                </RadioGroup>
              </FormControl>

              <FormControl orientation="horizontal" sx={{ justifyContent: 'space-between' }}>
                <Box>
                  <FormLabel>Markdown</FormLabel>
                  <FormHelperText>{renderMarkdown ? 'Render markdown' : 'Text only'}</FormHelperText>
                </Box>
                <Switch
                  checked={renderMarkdown}
                  onChange={handleRenderMarkdownChange}
                  endDecorator={renderMarkdown ? 'On' : 'Off'}
                  slotProps={{ endDecorator: { sx: { minWidth: 26 } } }}
                />
              </FormControl>

              <FormControl orientation="horizontal" sx={{ justifyContent: 'space-between' }}>
                <Box>
                  <FormLabel>Purpose Finder</FormLabel>
                  <FormHelperText>{showPurposeFinder ? 'Show search bar' : 'Hide search bar'}</FormHelperText>
                </Box>
                <Switch
                  checked={showPurposeFinder}
                  onChange={handleShowSearchBarChange}
                  endDecorator={showPurposeFinder ? 'On' : 'Off'}
                  slotProps={{ endDecorator: { sx: { minWidth: 26 } } }}
                />
              </FormControl>
            </Stack>

            <Stack direction="row" sx={{ mt: 3, gap: 2, alignItems: 'center' }}>
              <Typography>Speach Input Language</Typography>
            </Stack>

            <Typography level="body2" sx={{ mb: 1 }}>
              All browsers may not support all languages listed below.
            </Typography>

            <Select onChange={handleTextToSpeechLangChange} defaultValue={'en-US'} value={textToSpeechLang}>
              <Option value="ar-SA">Arabic</Option>
              <Option value="bn-BD">Bengali (Bangladesh)</Option>
              <Option value="bn-IN">Bengali (India)</Option>
              <Option value="ca-ES">Catalan</Option>
              <Option value="cmn-Hans-CN">Chinese (Mandarin, Simplified, China)</Option>
              <Option value="cmn-Hant-TW">Chinese (Mandarin, Traditional, Taiwan)</Option>
              <Option value="yue-Hant-HK">Chinese (Cantonese, Traditional, Hong Kong)</Option>
              <Option value="cs-CZ">Czech</Option>
              <Option value="da-DK">Danish</Option>
              <Option value="nl-BE">Dutch (Belgium)</Option>
              <Option value="nl-NL">Dutch (Netherlands)</Option>
              <Option value="en-AU">English (Australia)</Option>
              <Option value="en-CA">English (Canada)</Option>
              <Option value="en-IN">English (India)</Option>
              <Option value="en-IE">English (Ireland)</Option>
              <Option value="en-NZ">English (New Zealand)</Option>
              <Option value="en-PH">English (Philippines)</Option>
              <Option value="en-ZA">English (South Africa)</Option>
              <Option value="en-GB">English (UK)</Option>
              <Option value="en-US">English (US)</Option>
              <Option value="et-EE">Estonian</Option>
              <Option value="fi-FI">Finnish</Option>
              <Option value="fr-BE">French (Belgium)</Option>
              <Option value="fr-CA">French (Canada)</Option>
              <Option value="fr-FR">French (France)</Option>
              <Option value="fr-CH">French (Switzerland)</Option>
              <Option value="gl-ES">Galician</Option>
              <Option value="de-AT">German (Austria)</Option>
              <Option value="de-DE">German (Germany)</Option>
              <Option value="de-CH">German (Switzerland)</Option>
              <Option value="el-GR">Greek</Option>
              <Option value="gu-IN">Gujarati (India)</Option>
              <Option value="he-IL">Hebrew</Option>
              <Option value="hi-IN">Hindi</Option>
              <Option value="hu-HU">Hungarian</Option>
              <Option value="is-IS">Icelandic</Option>
              <Option value="id-ID">Indonesian</Option>
              <Option value="it-IT">Italian (Italy)</Option>
              <Option value="it-CH">Italian (Switzerland)</Option>
              <Option value="ja-JP">Japanese</Option>
              <Option value="jv-ID">Javanese</Option>
              <Option value="kn-IN">Kannada (India)</Option>
              <Option value="kk-KZ">Kazakh</Option>
              <Option value="km-KH">Khmer</Option>
              <Option value="ko-KR">Korean (South Korea)</Option>
              <Option value="lo-LA">Lao</Option>
              <Option value="lv-LV">Latvian</Option>
              <Option value="lt-LT">Lithuanian</Option>
              <Option value="mk-MK">Macedonian</Option>
              <Option value="ms-MY">Malay</Option>
              <Option value="ml-IN">Malayalam (India)</Option>
              <Option value="mr-IN">Marathi (India)</Option>
              <Option value="mn-MN">Mongolian</Option>
              <Option value="my-MM">Myanmar (Burmese)</Option>
              <Option value="ne-NP">Nepali</Option>
              <Option value="no-NO">Norwegian</Option>
              <Option value="pl-PL">Polish</Option>
              <Option value="pt-BR">Portuguese (Brazil)</Option>
              <Option value="pt-PT">Portuguese (Portugal)</Option>
              <Option value="pa-IN">Punjabi (India)</Option>
              <Option value="ro-RO">Romanian</Option>
              <Option value="ru-RU">Russian</Option>
              <Option value="sr-RS">Serbian</Option>
              <Option value="si-LK">Sinhala (Sri Lanka)</Option>
              <Option value="sk-SK">Slovak</Option>
              <Option value="sl-SI">Slovenian</Option>
              <Option value="es-AR">Spanish (Argentina)</Option>
              <Option value="es-BO">Spanish (Bolivia)</Option>
              <Option value="es-CL">Spanish (Chile)</Option>
              <Option value="es-CO">Spanish (Colombia)</Option>
              <Option value="es-CR">Spanish (Costa Rica)</Option>
              <Option value="es-DO">Spanish (Dominican Republic)</Option>
              <Option value="es-EC">Spanish (Ecuador)</Option>
              <Option value="es-SV">Spanish (El Salvador)</Option>
              <Option value="es-GT">Spanish (Guatemala)</Option>
              <Option value="es-HN">Spanish (Honduras)</Option>
              <Option value="es-MX">Spanish (Mexico)</Option>
              <Option value="es-NI">Spanish (Nicaragua)</Option>
              <Option value="es-PA">Spanish (Panama)</Option>
              <Option value="es-PY">Spanish (Paraguay)</Option>
              <Option value="es-PE">Spanish (Peru)</Option>
              <Option value="es-PR">Spanish (Puerto Rico)</Option>
              <Option value="es-ES">Spanish (Spain)</Option>
              <Option value="es-US">Spanish (US)</Option>
              <Option value="es-UY">Spanish (Uruguay)</Option>
              <Option value="es-VE">Spanish (Venezuela)</Option>
              <Option value="su-ID">Sundanese</Option>
              <Option value="sw-TZ">Swahili</Option>
              <Option value="sv-SE">Swedish</Option>
              <Option value="ta-IN">Tamil (India)</Option>
              <Option value="ta-SG">Tamil (Singapore)</Option>
              <Option value="ta-LK">Tamil (Sri Lanka)</Option>
              <Option value="te-IN">Telugu (India)</Option>
              <Option value="th-TH">Thai</Option>
              <Option value="tr-TR">Turkish</Option>
              <Option value="uk-UA">Ukrainian</Option>
              <Option value="ur-IN">Urdu (India)</Option>
              <Option value="ur-PK">Urdu (Pakistan)</Option>
              <Option value="uz-UZ">Uzbek</Option>
              <Option value="vi-VN">Vietnamese</Option>
              <Option value="cy-GB">Welsh (UK)</Option>
              <Option value="xh-ZA">Xhosa (South Africa)</Option>
              <Option value="yi-DE">Yiddish (Germany)</Option>
              <Option value="yo-NG">Yoruba (Nigeria)</Option>
              <Option value="zu-ZA">Zulu (South Africa)</Option>
            </Select>
          </Section>

          {/* Advanced Settings */}

          <Section title="Advanced AI settings" collapsible collapsed={true} disclaimer="Adjust only if you are familiar with these terms">
            <Stack direction="column" sx={{ gap: 3, mt: -0.8, maxWidth: 400 }}>
              <FormControl orientation="horizontal" sx={{ justifyContent: 'space-between' }}>
                <Box sx={{ minWidth: 130 }}>
                  <FormLabel>Temperature</FormLabel>
                  <FormHelperText>{modelTemperature < 0.33 ? 'More strict' : modelTemperature > 0.67 ? 'Larger freedom' : 'Creativity'}</FormHelperText>
                </Box>
                <Slider
                  aria-label="Model Temperature"
                  color="neutral"
                  min={0}
                  max={1}
                  step={0.1}
                  defaultValue={0.5}
                  value={modelTemperature}
                  onChange={handleTemperatureChange}
                  valueLabelDisplay="auto"
                  sx={{ py: 1, mt: 1.1 }}
                />
              </FormControl>

              <FormControl orientation="horizontal" sx={{ justifyContent: 'space-between' }}>
                <Box sx={{ minWidth: 130 }}>
                  <FormLabel>Max Tokens</FormLabel>
                  <FormHelperText>Response size</FormHelperText>
                </Box>
                <Slider
                  aria-label="Model Max Tokens"
                  color="neutral"
                  min={256}
                  max={4096}
                  step={256}
                  defaultValue={1024}
                  value={modelMaxResponseTokens}
                  onChange={handleMaxTokensChange}
                  valueLabelDisplay="auto"
                  sx={{ py: 1, mt: 1.1 }}
                />
              </FormControl>

              <FormControl orientation="horizontal" sx={{ justifyContent: 'space-between' }}>
                <Box sx={{ minWidth: 130 }}>
                  <FormLabel>
                    API Host
                    {/*<Tooltip title='Change API host for compatibility with services like Helicone' variant='solid'>*/}
                    {/*  <InfoIcon sx={{ ml: 1, cursor: 'pointer' }} />*/}
                    {/*</Tooltip>*/}
                  </FormLabel>
                  <FormHelperText sx={{ display: 'block' }}>
                    For{' '}
                    <Link level="body2" href="https://www.helicone.ai" target="_blank">
                      Helicone
                    </Link>
                  </FormHelperText>
                </Box>
                <Input variant="outlined" placeholder="api.openai.com" value={apiHost} onChange={handleApiHostChange} sx={{ flexGrow: 1 }} />
              </FormControl>

              <FormControl orientation="horizontal" sx={{ justifyContent: 'space-between' }}>
                <Box sx={{ minWidth: 130 }}>
                  <FormLabel>Organization ID</FormLabel>
                  <FormHelperText sx={{ display: 'block' }}>
                    <Link level="body2" href="https://github.com/enricoros/nextjs-chatgpt-app/issues/63" target="_blank">
                      What is this
                    </Link>
                  </FormHelperText>
                </Box>
                <Input
                  variant="outlined"
                  placeholder="Optional, for org users"
                  value={apiOrganizationId}
                  onChange={handleApiOrganizationIdChange}
                  sx={{ flexGrow: 1 }}
                />
              </FormControl>
            </Stack>
          </Section>

          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="solid" color={isValidKey ? 'primary' : 'neutral'} onClick={onClose}>
              Close
            </Button>
          </Box>
        </ModalDialog>
      </ModalOverflow>
    </Modal>
  );
}

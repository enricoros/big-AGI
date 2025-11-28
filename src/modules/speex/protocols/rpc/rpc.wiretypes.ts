import * as z from 'zod/v4';


/**
 * Streaming Speech Synthesis Particle (TS-only) schema
 */
export type SpeexSpeechParticle =
  | { t: 'start' }
  | { t: 'audio'; base64: string; chunk: boolean; contentType?: string; characterCost?: number; ttsLatencyMs?: number }
  | { t: 'done'; durationMs?: number; chars: number; audioBytes: number }
  | { t: 'log'; level: 'info', message: string }
  | { t: 'error'; e: string }
  ;


export type SpeexWire_Access = z.infer<typeof SpeexWire.Access_schema>;
export type SpeexWire_Access_ElevenLabs = z.infer<typeof SpeexWire.AccessElevenLabs_schema>;
export type SpeexWire_Access_OpenAI = z.infer<typeof SpeexWire.AccessOpenAI_schema>;

export type SpeexWire_Voice = z.infer<typeof SpeexWire.Voice_schema>;

export type SpeexWire_Synthesize_Input = z.infer<typeof SpeexWire.Synthesize_input_schema>;

export type SpeexWire_VoiceOption = z.infer<typeof SpeexWire.VoiceOption_schema>;
export type SpeexWire_ListVoices_Input = z.infer<typeof SpeexWire.ListVoices_input_schema>;
export type SpeexWire_ListVoices_Output = z.infer<typeof SpeexWire.ListVoices_output_schema>;


/**
 * Wire Protocol Schemas for Speex module
 */
export namespace SpeexWire {

  // Access schemas - discriminated union by dialect

  export const AccessElevenLabs_schema = z.object({
    dialect: z.literal('elevenlabs'),
    apiKey: z.string(),
    apiHost: z.string().optional(),
  });

  export const AccessOpenAI_schema = z.object({
    dialect: z.enum(['localai', 'openai']),
    apiKey: z.string().optional(),  // openai: required, localai: optional
    apiHost: z.string().optional(), // localai: required, openai: optional
    apiOrgId: z.string().optional(),   // openai only
  });

  export const Access_schema = z.discriminatedUnion('dialect',
    [AccessElevenLabs_schema, AccessOpenAI_schema],
  );


  // Voice schemas - per dialect

  export const VoiceElevenLabs_schema = z.object({
    dialect: z.literal('elevenlabs'),
    ttsModel: z.string().optional(),
    ttsVoiceId: z.string().optional(),
  });

  export const VoiceLocalAI_schema = z.object({
    dialect: z.literal('localai'),
    ttsBackend: z.string().optional(),   // e.g., 'coqui', 'bark', 'piper', 'vall-e-x'
    ttsModel: z.string().optional(),     // e.g., 'kokoro', 'tts_models/en/ljspeech/glow-tts'
    ttsLanguage: z.string().optional(),  // for multilingual models like xtts_v2
  });

  export const VoiceOpenAI_schema = z.object({
    dialect: z.literal('openai'),
    ttsModel: z.enum(['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts']).optional(),
    ttsVoiceId: z.string().optional(),
    ttsSpeed: z.number().min(0.25).max(4.0).optional(),
    ttsInstruction: z.string().optional(),
  });

  export const Voice_schema = z.discriminatedUnion('dialect',
    [VoiceElevenLabs_schema, VoiceLocalAI_schema, VoiceOpenAI_schema],
  );


  // .Synthesize input schema

  export const Synthesize_input_schema = z.object({
    access: SpeexWire.Access_schema,
    text: z.string(),
    voice: SpeexWire.Voice_schema,
    streaming: z.boolean(),
    languageCode: z.string().optional(), // ISO language code (e.g., 'en', 'fr') for model selection fallback
    priority: z.enum(['fast', 'balanced', 'quality']).optional(), // Hint for speed vs quality tradeoff
  });


  // .ListVoices voice schema

  export const VoiceOption_schema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    previewUrl: z.string().optional(),
    category: z.string().optional(),    // e.g., 'premade', 'cloned', 'professional'
    // Voice labels (flattened for simplicity)
    // gender: z.string().optional(),      // e.g., 'male', 'female', 'neutral'
    // accent: z.string().optional(),      // e.g., 'american', 'british', 'australian'
    // age: z.string().optional(),         // e.g., 'young', 'middle_aged', 'old'
    // language: z.string().optional(),    // e.g., 'en', 'es', 'multilingual'
  });

  export const ListVoices_input_schema = z.object({
    access: SpeexWire.Access_schema,
  });

  export const ListVoices_output_schema = z.object({
    voices: z.array(VoiceOption_schema),
  });

}
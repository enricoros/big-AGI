import * as z from 'zod/v4';


/**
 * Streaming Speech Synthesis Particle (TS-only) schema
 */
export type SpeexSpeechParticle =
  | { t: 'start' }
  | { t: 'audio'; base64: string; final?: boolean }
  | { t: 'done'; durationMs?: number; chars?: number }
  | { t: 'error'; e: string }
  ;


export type SpeexWire_Access = z.infer<typeof SpeexWire.Access_schema>;
export type SpeexWire_Access_ElevenLabs = z.infer<typeof SpeexWire.AccessElevenLabs_schema>;
export type SpeexWire_Access_OpenAI = z.infer<typeof SpeexWire.AccessOpenAI_schema>;

export type SpeexWire_Voice = z.infer<typeof SpeexWire.Voice_schema>;

export type SpeexWire_Synthesize_Input = z.infer<typeof SpeexWire.Synthesize_input_schema>;

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
    orgId: z.string().optional(),   // openai only
  });

  export const Access_schema = z.discriminatedUnion('dialect',
    [AccessElevenLabs_schema, AccessOpenAI_schema],
  );


  // Voice schemas - per dialect

  export const ElevenLabs_schema = z.object({
    dialect: z.literal('elevenlabs'),
    voiceId: z.string().optional(),
    model: z.string().optional(),
  });

  export const LocalAI_schema = z.object({
    dialect: z.literal('localai'),
    voiceId: z.string().optional(),
    model: z.string().optional(),
  });

  export const OpenAI_schema = z.object({
    dialect: z.literal('openai'),
    voiceId: z.string().optional(),
    model: z.enum(['tts-1', 'tts-1-hd']).optional(),
    speed: z.number().min(0.25).max(4.0).optional(),
    instruction: z.string().optional(),
  });

  export const Voice_schema = z.discriminatedUnion('dialect',
    [ElevenLabs_schema, LocalAI_schema, OpenAI_schema],
  );


  // .Synthesize input schema

  export const Synthesize_input_schema = z.object({
    access: SpeexWire.Access_schema,
    text: z.string(),
    voice: SpeexWire.Voice_schema,
    streaming: z.boolean().default(true),
  });


  // .ListVoices voice schema

  export const ListVoices_input_schema = z.object({
    access: SpeexWire.Access_schema,
  });

  export const ListVoices_output_schema = z.object({
    voices: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      previewUrl: z.string().optional(),
      category: z.string().optional(),
    })),
  });

}
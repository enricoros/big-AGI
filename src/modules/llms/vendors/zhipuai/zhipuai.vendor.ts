import type { DLLM, DModelInterfaceV1, DModelParameterSpec } from '~/common/stores/llms/llms.types';
import { LLM_IF_OAI_Chat, LLM_IF_Outputs_Image } from '~/common/stores/llms/llms.types';
import type { IModelVendor } from '../IModelVendor';
import { IconCloudService } from '~/common/components/icons/vendors/IconCloudService'; // Placeholder
import { DModelParameterEnumSpec, DModelParameterStringSpec } from '~/common/stores/llms/llms.parameters';
import { ZhipuAIServiceSetup } from './ZhipuAIServiceSetup';

// Define the ZhipuAI Access Schema
// For now, putting it here. Could be moved to a zhipuai.types.ts
export interface ZhipuAIAccessSchema {
  apiKey: string;
  // Potentially other fields like endpoint, if needed in the future
}

// Default API Key - to be used if not overridden by user settings (though ideally, this comes from env or config)
// For this exercise, using the one provided in the subtask.
const DEFAULT_ZHIPUAI_API_KEY = '924d10ce4718479a9a089ffdc62aafff.d69Or12B5PEdYUco';

export const vendorZhipuAI: IModelVendor<ZhipuAIAccessSchema, object, ZhipuAIAccessSchema> = {
  id: 'zhipuai',
  name: 'ZhipuAI',
  displayRank: 25, // High rank
  location: 'cloud',
  instanceLimit: 1,

  Icon: IconCloudService, // Placeholder icon

  ServiceSetupComponent: ZhipuAIServiceSetup,

  // Provides the initial setup object with the default API key
  initializeSetup: () => ({
    // In a real scenario, this might come from env variables or be empty for user input
    zhipuApiKey: DEFAULT_ZHIPUAI_API_KEY,
  }),

  // Transforms the setup object (which might just contain zhipuApiKey)
  // into the access schema required by the backend.
  getTransportAccess: (setup) => ({
    apiKey: setup?.zhipuApiKey || DEFAULT_ZHIPUAI_API_KEY,
  }),

  // Placeholder - to be implemented
  rpcUpdateModelsOrThrow: async (accessSchema, serviceId) => {
    // Custom interface for video generation
    const LLM_IF_Generates_Video: DModelInterfaceV1 = 'outputs-video' as DModelInterfaceV1; // Cast if not in official list

    const glm4Flash: DLLM = {
      id: 'zhipuai-glm-4-flash',
      label: 'GLM-4-Flash',
      created: 0,
      description: 'ZhipuAI GLM-4-Flash text generation model',
      hidden: false,
      contextTokens: 128000, // As per ZhipuAI documentation (128k)
      maxOutputTokens: 4096, // Assuming a default, adjust if specified
      interfaces: [LLM_IF_OAI_Chat],
      sId: serviceId!,
      vId: 'zhipuai',
      parameterSpecs: [], // TODO: Add relevant parameters if any (e.g., temperature, top_p)
      initialParameters: {},
    };

    const cogView3Flash: DLLM = {
      id: 'zhipuai-cogview-3-flash',
      label: 'CogView-3-Flash',
      created: 0,
      description: 'ZhipuAI CogView-3-Flash image generation model',
      hidden: false,
      contextTokens: 1024, // Typical for image prompts
      maxOutputTokens: 0, // Not applicable for image output
      interfaces: [LLM_IF_Outputs_Image],
      sId: serviceId!,
      vId: 'zhipuai',
      // Parameters from docs: prompt (string, required), image_id (string), size ("1024*1024", "2048*2048", "4096*4096"), quality ("standard", "hd")
      // width, height are not directly params but derived from 'size'. Let's use 'size' as a param.
      parameterSpecs: [
        { id: 'size', name: 'Size', type: 'enum', init: '1024*1024', isSystem: false, isTuneable: true, values: ['1024*1024', '2048*2048', '4096*4096'], valueNames: {} } as DModelParameterEnumSpec,
        { id: 'quality', name: 'Quality', type: 'enum', init: 'standard', isSystem: false, isTuneable: true, values: ['standard', 'hd'], valueNames: {} } as DModelParameterEnumSpec,
        // image_id is for image-to-image, not directly for T2I generation config here.
      ],
      initialParameters: { size: '1024*1024', quality: 'standard' },
    };

    // Add LLM_IF_Generates_Video to DModelInterfaceV1 if it's not already there for type checking
    // This is a workaround if the type isn't updated globally yet.
    if (!([LLM_IF_OAI_Chat, LLM_IF_Outputs_Image] as string[]).includes(LLM_IF_Generates_Video)) {
      // console.warn(`Interface ${LLM_IF_Generates_Video} not in DModelInterfaceV1, consider adding it.`);
    }

    const cogVideoXFlash: DLLM = {
      id: 'zhipuai-cogvideox-flash',
      label: 'CogVideoX-Flash',
      created: 0,
      description: 'ZhipuAI CogVideoX-Flash video generation model',
      hidden: false,
      contextTokens: 2048, // Assuming a reasonable context for video prompts
      maxOutputTokens: 0, // Not applicable for video output
      interfaces: [LLM_IF_Generates_Video],
      sId: serviceId!,
      vId: 'zhipuai',
      // Params: prompt (string, required), image_url (string), quality ("standard", "hd"), with_audio (boolean, default false), size ("1280*720", "720*1280", "576*1024", "1024*576"), fps (integer, 15-60, default 25)
      parameterSpecs: [
        { id: 'image_url', name: 'Image URL (optional)', type: 'string', init: '', isSystem: false, isTuneable: true, editAs: 'uri' } as DModelParameterStringSpec,
        { id: 'quality', name: 'Quality', type: 'enum', init: 'standard', isSystem: false, isTuneable: true, values: ['standard', 'hd'], valueNames: {} } as DModelParameterEnumSpec,
        { id: 'with_audio', name: 'With Audio', type: 'boolean', init: false, isSystem: false, isTuneable: true } as DModelParameterSpec<'boolean'>, // Cast for now
        { id: 'size', name: 'Size', type: 'enum', init: '1280*720', isSystem: false, isTuneable: true, values: ['1280*720', '720*1280', '576*1024', '1024*576'], valueNames: {} } as DModelParameterEnumSpec,
        { id: 'fps', name: 'FPS', type: 'integer', init: 25, min: 15, max: 60, step: 1, isSystem: false, isTuneable: true } as DModelParameterSpec<'integer'>, // Cast for now
      ],
      initialParameters: { image_url: '', quality: 'standard', with_audio: false, size: '1280*720', fps: 25 },
    };

    const models: DLLM[] = [glm4Flash, cogView3Flash, cogVideoXFlash];
    const now = Date.now();
    // These models are static, so they don't really "expire" unless the vendor definition changes
    return { models, expires: now + 30 * 24 * 60 * 60 * 1000 }; // Expires in 30 days
  },
};

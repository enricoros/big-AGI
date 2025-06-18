import type { DLLM, DModelInterfaceV1, DModelParameterSpec } from '~/common/stores/llms/llms.types';
import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';
import { LLM_IF_OAI_Chat, LLM_IF_Outputs_Image } from '~/common/stores/llms/llms.types';

// Using a generic cloud icon for now
import { IconCloudService } from '~/common/components/icons/vendors/IconCloudService';
import { DModelParameterBooleanSpec, DModelParameterEnumSpec, DModelParameterFloatSpec, DModelParameterIntegerSpec, DModelParameterStringSpec } from '~/common/stores/llms/llms.parameters';

/**
 * Pollinations.ai Vendor
 *
 * Keyless, free text and image generation models.
 *  - Text models: https://text.pollinations.ai/models
 *  - Image models: https://image.pollinations.ai/models
 */
export const vendorPollinations: IModelVendor<unknown, unknown, OpenAIAccessSchema> = {
  id: 'pollinations',
  name: 'Pollinations',
  displayRank: 55, // Example rank, adjust as needed
  location: 'cloud',
  instanceLimit: 1,
  hasFreeModels: true,

  Icon: IconCloudService, // Placeholder icon

  ServiceSetupComponent: null, // No setup needed for keyless access

  getTransportAccess: (_spec) => ({
    dialect: 'pollinations', // Custom dialect for server-side handling
    oaiKey: '', // No API key needed
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
    moderationKey: '',
    azureSetup: undefined,
  }),

  // RPC method to update models
  rpcUpdateModelsOrThrow: async (access, serviceId) => {
    let textModels: DLLM[] = [];
    try {
      const textModelsResponse = await fetch('https://text.pollinations.ai/models');
      if (!textModelsResponse.ok)
        throw new Error(`Failed to fetch text models: ${textModelsResponse.statusText}`);
      const textModelsRaw: { [id: string]: { name?: string, parameters?: any, 'context_length'?: number, 'max_tokens'?: number, description?: string } } = await textModelsResponse.json();

      textModels = Object.entries(textModelsRaw).map(([id, model]): DLLM => {
        // Define a helper to create parameter specifications
        const param = <T>(id: string, name: string, def: T, type?: 'string' | 'number' | 'integer' | 'boolean' | 'enum', options?: any): DModelParameterSpec<any> => {
          const baseSpec = { id, name, init: def, isSystem: false, isTuneable: true };
          if (type === 'string') return { ...baseSpec, type: 'string', editTitle: name, editAs: 'textarea', ...(options || {}) } as DModelParameterStringSpec;
          if (type === 'number') return { ...baseSpec, type: 'float', min: 0, max: 100, step: 0.1, ...(options || {}) } as DModelParameterFloatSpec;
          if (type === 'integer') return { ...baseSpec, type: 'integer', min: 0, max: 100, step: 1, ...(options || {}) } as DModelParameterIntegerSpec;
          if (type === 'boolean') return { ...baseSpec, type: 'boolean', ...(options || {}) } as DModelParameterBooleanSpec;
          if (type === 'enum') return { ...baseSpec, type: 'enum', values: [], valueNames: {}, ...(options || {}) } as DModelParameterEnumSpec;
          return { ...baseSpec, type: 'string', editTitle: name, editAs: 'textarea' } as DModelParameterStringSpec; // Default to string
        };

        const parameterSpecs: DModelParameterSpec<any>[] = [];
        const initialParameters: { [key: string]: any } = {};

        if (model.parameters) {
          for (const p of model.parameters) {
            // Example: p = { name: "temperature", type: "float", default: 0.8, min:0, max:1, description: "..."}
            // Map Pollinations types to DModelParameter types (this is an example, adjust as needed)
            let paramType: 'string' | 'number' | 'integer' | 'boolean' | 'enum' | undefined = undefined;
            if (p.type === 'float' || p.type === 'number') paramType = 'number';
            else if (p.type === 'integer') paramType = 'integer';
            else if (p.type === 'boolean') paramType = 'boolean';
            else if (p.type === 'string') paramType = 'string';
            // TODO: handle enum if Pollinations has it

            const spec = param(
              p.name,
              p.name.charAt(0).toUpperCase() + p.name.slice(1), // Capitalize name for label
              p.default,
              paramType,
              { min: p.min, max: p.max, description: p.description }
            );
            parameterSpecs.push(spec);
            initialParameters[p.name] = p.default;
          }
        }


        return {
          id: `pollinations-${id}`, // Prepend vendor id to avoid collisions
          label: model.name || id,
          created: 0, // Placeholder
          description: model.description || 'Pollinations Text Model',
          hidden: false, // Make them visible
          contextTokens: model['context_length'] || 4096, // Default if not provided
          maxOutputTokens: model['max_tokens'] || null, // Default if not provided
          interfaces: [LLM_IF_OAI_Chat] as DModelInterfaceV1[], // Assuming chat interface
          sId: serviceId!,
          vId: 'pollinations',
          parameterSpecs,
          initialParameters,
        };
      });
    } catch (error) {
      console.error('Failed to fetch or map Pollinations text models:', error);
      // Optionally, re-throw or handle to prevent breaking the entire model update
    }

    let imageModels: DLLM[] = [];
    try {
      const imageModelsResponse = await fetch('https://image.pollinations.ai/models');
      if (!imageModelsResponse.ok)
        throw new Error(`Failed to fetch image models: ${imageModelsResponse.statusText}`);
      // Assuming a similar structure for image models as text models for now
      const imageModelsRaw: { [id: string]: { name?: string, parameters?: any, description?: string, width?: number, height?: number, context_length?: number } } = await imageModelsResponse.json();

      imageModels = Object.entries(imageModelsRaw).map(([id, model]): DLLM => {
        // Define a helper to create parameter specifications (can be reused or adapted)
        const param = <T>(paramId: string, name: string, def: T, type?: 'string' | 'number' | 'integer' | 'boolean' | 'enum', options?: any): DModelParameterSpec<any> => {
          const baseSpec = { id: paramId, name, init: def, isSystem: false, isTuneable: true };
          if (type === 'string') return { ...baseSpec, type: 'string', editTitle: name, editAs: 'textarea', ...(options || {}) } as DModelParameterStringSpec;
          if (type === 'number') return { ...baseSpec, type: 'float', min: 0, max: 10000, step: 1, ...(options || {}) } as DModelParameterFloatSpec; // Adjusted max for potential pixel values
          if (type === 'integer') return { ...baseSpec, type: 'integer', min: 0, max: 10000, step: 1, ...(options || {}) } as DModelParameterIntegerSpec; // Adjusted max
          if (type === 'boolean') return { ...baseSpec, type: 'boolean', ...(options || {}) } as DModelParameterBooleanSpec;
          if (type === 'enum') return { ...baseSpec, type: 'enum', values: [], valueNames: {}, ...(options || {}) } as DModelParameterEnumSpec;
          return { ...baseSpec, type: 'string', editTitle: name, editAs: 'textarea' } as DModelParameterStringSpec;
        };

        const parameterSpecs: DModelParameterSpec<any>[] = [];
        const initialParameters: { [key: string]: any } = {};

        if (model.parameters) {
          for (const p of model.parameters) {
            let paramType: 'string' | 'number' | 'integer' | 'boolean' | 'enum' | undefined = undefined;
            if (p.type === 'float' || p.type === 'number') paramType = 'number';
            else if (p.type === 'integer') paramType = 'integer';
            else if (p.type === 'boolean') paramType = 'boolean';
            else if (p.type === 'string') paramType = 'string';
            // TODO: handle enum

            const spec = param(
              p.name,
              p.name.charAt(0).toUpperCase() + p.name.slice(1),
              p.default,
              paramType,
              { min: p.min, max: p.max, description: p.description }
            );
            parameterSpecs.push(spec);
            initialParameters[p.name] = p.default;
          }
        }

        // Add width and height as parameters if not already present from the API's parameter list
        if (model.width && !parameterSpecs.find(p => p.id === 'width')) {
            parameterSpecs.push(param('width', 'Width', model.width, 'integer', { min: 64, max: 2048, step: 64 }));
            initialParameters['width'] = model.width;
        }
        if (model.height && !parameterSpecs.find(p => p.id === 'height')) {
            parameterSpecs.push(param('height', 'Height', model.height, 'integer', { min: 64, max: 2048, step: 64 }));
            initialParameters['height'] = model.height;
        }
        // Add seed as a common image generation parameter
        if (!parameterSpecs.find(p => p.id === 'seed')) {
            parameterSpecs.push(param('seed', 'Seed', -1, 'integer', {min: -1, max: 2147483647, description: 'Seed for image generation. -1 for random.'}));
            initialParameters['seed'] = -1;
        }


        return {
          id: `pollinations-${id}`, // Prepend vendor id
          label: model.name || id,
          created: 0,
          description: model.description || 'Pollinations Image Model',
          hidden: false,
          contextTokens: model['context_length'] || 1024, // Image models might have smaller context for prompts
          maxOutputTokens: 0, // Not applicable for image output in the same way
          interfaces: [LLM_IF_Outputs_Image] as DModelInterfaceV1[], // Mark as image model
          sId: serviceId!,
          vId: 'pollinations',
          parameterSpecs,
          initialParameters,
        };
      });
    } catch (error) {
      console.error('Failed to fetch or map Pollinations image models:', error);
    }

    const allModels = [...textModels, ...imageModels];
    const now = Date.now();
    return { models: allModels, expires: now + 24 * 60 * 60 * 1000 }; // Expires in 1 day
  },
};

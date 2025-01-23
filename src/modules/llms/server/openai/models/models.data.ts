import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { _knownOpenAIChatModels } from './openai.models';
import { wireGroqModelsListOutputSchema } from '../groq.wiretypes';
import { wireOpenPipeModelOutputSchema } from '../openpipe.wiretypes';
import { wireOpenrouterModelsListOutputSchema } from '../openrouter.wiretypes';


export function azureModelToModelDescription(azureDeploymentRef: string, openAIModelIdBase: string, modelCreated: number, modelUpdated?: number): ModelDescriptionSchema {
  // if the deployment name mataches an OpenAI model prefix, use that
  const known = _knownOpenAIChatModels.find(base => azureDeploymentRef == base.idPrefix);
  return fromManualMapping(_knownOpenAIChatModels, known ? azureDeploymentRef : openAIModelIdBase, modelCreated, modelUpdated, undefined, true);
}


// [LM Studio]
export function lmStudioModelToModelDescription(modelId: string): ModelDescriptionSchema {

  // LM Studio model ID's are the file names of the model files
  function getFileName(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return normalizedPath.split('/').pop() || '';
  }

  return fromManualMapping([], modelId, undefined, undefined, {
    idPrefix: modelId,
    label: getFileName(modelId)
      .replace('.gguf', '')
      .replace('.bin', ''),
    // .replaceAll('-', ' '),
    description: `Unknown LM Studio model. File: ${modelId}`,
    contextWindow: null, // 'not provided'
    interfaces: [LLM_IF_OAI_Chat], // assume..
    chatPrice: { input: 'free', output: 'free' },
  });
}


// [LocalAI]
const _knownLocalAIChatModels: ManualMappings = [
  {
    idPrefix: 'ggml-gpt4all-j',
    label: 'GPT4All-J',
    description: 'GPT4All-J on LocalAI',
    contextWindow: 2048,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    idPrefix: 'luna-ai-llama2',
    label: 'Luna AI Llama2 Uncensored',
    description: 'Luna AI Llama2 on LocalAI',
    contextWindow: 4096,
    interfaces: [LLM_IF_OAI_Chat],
  },
];

export function localAIModelToModelDescription(modelId: string): ModelDescriptionSchema {
  return fromManualMapping(_knownLocalAIChatModels, modelId, undefined, undefined, {
    idPrefix: modelId,
    label: modelId
      .replace('ggml-', '')
      .replace('.bin', '')
      .replaceAll('-', ' '),
    description: 'Unknown localAI model. Please update `models.data.ts` with this ID',
    contextWindow: null, // 'not provided'
    interfaces: [LLM_IF_OAI_Chat], // assume..
    chatPrice: { input: 'free', output: 'free' },
  });
}


// [Mistral] moved to own file


// [OpenPipe]

const _knownOpenPipeChatModels: ModelDescriptionSchema[] = [
{
  id: 'openpipe:deepseek/deepseek-r1',
  label: '💾➜ DeepSeek R1',
  description: 'DeepSeek-R1 is here!\n\n⚡ Performance on par with OpenAI-o1\n📖 Fully open-source model & technical report\n🏆 MIT licensed: Distill & commercialize freely!',
  contextWindow: 64000,
  maxCompletionTokens: 8000,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  chatPrice: { input: 550000, output: 2190000 },
},
{
  id: 'openpipe:sophosympatheia/rogue-rose-103b-v0.2:free',
  label: '💾➜ Rogue Rose 103B v0.2 🎁',
  description: 'Rogue Rose demonstrates strong capabilities in roleplaying and storytelling applications, potentially surpassing other models in the 103-120B parameter range. While it occasionally exhibits inconsistencies with scene logic, the overall interaction quality represents an advancement in natural language processing for creative applications. Based on a 120-layer frankenmerge model combining two custom 70B architectures.',
  contextWindow: 4096,
  maxCompletionTokens: 2048,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat],
  chatPrice: { input: 0, output: 0 },
},
{
  id: 'openpipe:minimax/minimax-01',
  label: '💾➜ MiniMax-01 🎁',
  description: 'MiniMax-01 combines MiniMax-Text-01 for text generation and MiniMax-VL-01 for image understanding. It has 456 billion parameters, with 45.9 billion parameters activated per inference, and can handle a context of up to 4 million tokens. The text model adopts a hybrid architecture combining Lightning Attention, Softmax Attention, and Mixture-of-Experts (MoE). The image model adopts the "ViT-MLP-LLM" framework.',
  contextWindow: 1000192,
  maxCompletionTokens: 1000192,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
  chatPrice: { input: 200, output: 1100 },
},
{
  id: 'openpipe:mistralai/codestral-2501',
  label: '💾➜ Mistral Codestral 2501 🎁',
  description: 'Mistral\'s cutting-edge language model for coding. Codestral specializes in low-latency, high-frequency tasks such as fill-in-the-middle (FIM), code correction and test generation. Features a massive 256K context window for handling large codebases and documentation.',
  contextWindow: 256000,
  maxCompletionTokens: 8192,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  chatPrice: { input: 300, output: 900 },
},
{
  id: 'openpipe:microsoft/phi-4',
  label: '💾➜ Microsoft Phi-4 🎁',
  description: 'Microsoft Research Phi-4 is designed to perform well in complex reasoning tasks and can operate efficiently in situations with limited memory or where quick responses are needed. At 14 billion parameters, it was trained on a mix of high-quality synthetic datasets, data from curated websites, and academic materials. It has undergone careful improvement to follow instructions accurately and maintain strong safety standards.',
  contextWindow: 16384,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  chatPrice: { input: 70, output: 140 },
},
{
  id: 'openpipe:sao10k/l3.1-70b-hanami-x1',
  label: '💾➜ Sao10K Llama 3.1 70B Hanami x1 🎁',
  description: 'An experimental model from Sao10K built on their Euryale v2.2 base. Features enhanced context handling capabilities and improved performance on creative and narrative tasks. Optimized for maintaining coherence in extended conversations.',
  contextWindow: 16000,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat],
  chatPrice: { input: 3000, output: 3000 },
},
{
  id: 'openpipe:mistralai/codestral-mamba',
  label: '💾➜ Mistral Codestral Mamba 🎁',
  description: 'A 7.3B parameter Mamba-based model designed for code and reasoning tasks. Features linear time inference allowing for theoretically infinite sequence lengths, 256K token context window, and optimized for quick responses. Performs comparably to state-of-the-art transformer models in code and reasoning tasks. Available under Apache 2.0 license.',
  contextWindow: 256000,
  maxCompletionTokens: 8192,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  chatPrice: { input: 250, output: 250 },
},
{
  id: 'openpipe:ai21/jamba-1-5-large',
  label: '💾➜ AI21 Jamba 1.5 Large 🎁',
  description: 'Jamba 1.5 Large is part of AI21\'s new family of open models, offering superior speed, efficiency, and quality. Features a 256K effective context window, the longest among open models, enabling improved performance on tasks like document summarization and analysis. Built on a novel SSM-Transformer architecture, it outperforms larger models like Llama 3.1 70B on benchmarks while maintaining resource efficiency.',
  contextWindow: 256000,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  chatPrice: { input: 2000, output: 8000 },
},
{
  id: 'openpipe:ai21/jamba-1-5-mini',
  label: '💾➜ AI21 Jamba 1.5 Mini 🎁',
  description: 'Jamba 1.5 Mini is the world\'s first production-grade Mamba-based model, combining SSM and Transformer architectures for a 256K context window and high efficiency. Works with 9 languages and can handle various writing and analysis tasks as well as or better than similar small models. Uses less computer memory and works faster with longer texts than previous designs.',
  contextWindow: 256000,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  chatPrice: { input: 200, output: 400 },
},
{
  id: 'openpipe:microsoft/phi-3.5-mini-128k-instruct',
  label: '💾➜ Microsoft Phi-3.5 Mini 128K 🎁',
  description: 'Phi-3.5 Mini uses 3.8B parameters and is a dense decoder-only transformer model. These models were trained with Phi-3 datasets that include both synthetic data and filtered, publicly available websites data, with a focus on high quality and reasoning-dense properties. Features robust safety measures and achieves state-of-the-art performance among models under 13B parameters.',
  contextWindow: 128000,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  chatPrice: { input: 100, output: 100 },
},
{
  id: 'openpipe:microsoft/phi-3.5-medium-128k-instruct',
  label: '💾➜ Microsoft Phi-3.5 Medium 128K 🎁',
  description: 'Phi-3.5 128K Medium is a powerful 14-billion parameter model designed for advanced language understanding, reasoning, and instruction following. Optimized through supervised fine-tuning and preference adjustments, it excels in tasks involving common sense, mathematics, logical reasoning, and code processing. In the MMLU-Pro eval, the model even comes close to a Llama3 70B level of performance.',
  contextWindow: 128000,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  chatPrice: { input: 1000, output: 1000 },
},
{
  id: 'openpipe:liquid/lfm-40b',
  label: '💾➜ Liquid LFM 40B MoE 🎁',
  description: 'Liquid\'s 40.3B Mixture of Experts (MoE) model. Liquid Foundation Models (LFMs) are large neural networks built with computational units rooted in dynamic systems. LFMs are general-purpose AI models that can be used to model any kind of sequential data, including video, audio, text, time series, and signals.',
  contextWindow: 66000,
  maxCompletionTokens: 66000,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat],
  chatPrice: { input: 150, output: 150 },
},
{
  id: 'openpipe:thedrummer/rocinante-12b',
  label: '💾➜ Rocinante 12B 🎁',
  description: 'Rocinante 12B is designed for engaging storytelling and rich prose. Early testers have reported expanded vocabulary with unique and expressive word choices, enhanced creativity for vivid narratives, and ability to generate adventure-filled and captivating stories.',
  contextWindow: 32768,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat],
  chatPrice: { input: 250, output: 500 },
},
{
  id: 'openpipe:qwen/qwen-2.5-72b-instruct-turbo',
  label: '💾➜ Qwen 2.5 72B Instruct Turbo 🎁',
  description: 'High-performance 72B parameter model optimized for speed and efficiency. Features state-of-the-art instruction following capabilities and enhanced reasoning. Achieves 93.1 on RULER benchmark and excels in long-text tasks with 100% accuracy in 1M length Passkey Retrieval. Particularly strong in technical and analytical tasks.',
  contextWindow: 32768,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-09',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
  chatPrice: { input: 230, output: 400 },
},
{
  id: 'openpipe:totalgpt/Midnight-Miqu-70B-v1.5',
  label: '💾➜ Midnight Miqu 70B v1.5 🎁',
  description: 'Creative writing focused 70B parameter model with exceptional performance in storytelling and roleplaying. Features advanced narrative generation capabilities and strong character consistency. Achieves consistent 77+ scores on EQ-Bench, demonstrating high emotional intelligence in dialogue generation.',
  contextWindow: 32768,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Json],
  chatPrice: { input: 200000, output: 400000 },
},
{
  id: 'openpipe:microsoft/wizardlm-2-8x22b',
  label: '💾➜ WizardLM 2 8x22B 🎁',
  description: 'WizardLM-2 8x22B is Microsoft AI\'s most advanced Wizard model. It demonstrates highly competitive performance compared to leading proprietary models, and consistently outperforms all existing state-of-the-art opensource models. Features sophisticated mixture-of-experts architecture for enhanced problem-solving. Built as an instruct finetune of Mixtral 8x22B.',
  contextWindow: 65536,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  chatPrice: { input: 500, output: 500 },
},
{
  id: 'openpipe:microsoft/wizardlm-2-7b',
  label: '💾➜ WizardLM 2 7B 🎁',
  description: 'WizardLM-2 7B is the smaller variant of Microsoft AI\'s latest Wizard model. It is the fastest and achieves comparable performance with existing 10x larger opensource leading models. Built as a finetune of Mistral 7B Instruct, using the same technique as WizardLM-2 8x22B.',
  contextWindow: 32000,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  chatPrice: { input: 70, output: 70 },
},
{
  id: 'openpipe:google/gemini-pro-1.5',
  label: '💾➜ Google Gemini Pro 1.5 🎁',
  description: 'Google\'s latest multimodal model, supports image and video inputs in text or chat prompts. Optimized for language tasks including code generation, text generation and editing, problem solving, recommendations, information extraction, data extraction or generation, and AI agents. Features an industry-leading 2M token context window.',
  contextWindow: 2000000,
  maxCompletionTokens: 8192,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
  chatPrice: { input: 1250, output: 5000 },
},
{
  id: 'openpipe:openai/gpt-4-turbo',
  label: '💾➜ OpenAI GPT-4 Turbo 🎁',
  description: 'The latest GPT-4 Turbo model with vision capabilities. Vision requests can now use JSON mode and function calling. Features improved instruction following, reproducible outputs, and parallel function calling. Training data up to December 2023.',
  contextWindow: 128000,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2023-12',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
  chatPrice: { input: 10000, output: 30000 },
},
{
  id: 'openpipe:cohere/command-r-plus',
  label: '💾➜ Cohere Command R+ 🎁',
  description: 'Command R+ is a new, 104B-parameter LLM from Cohere. It\'s useful for roleplay, general consumer usecases, and Retrieval Augmented Generation (RAG). Features multilingual support for ten key languages to facilitate global business operations. Offers roughly 50% higher throughput and 25% lower latencies compared to previous Command R+ versions.',
  contextWindow: 128000,
  maxCompletionTokens: 4000,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  chatPrice: { input: 2850, output: 14250 },
},
{
  id: 'openpipe:databricks/dbrx-instruct',
  label: '💾➜ Databricks DBRX 132B Instruct 🎁',
  description: 'DBRX is a new open source large language model developed by Databricks. At 132B parameters, it outperforms existing open source LLMs like Llama 2 70B and Mixtral-8x7b on standard industry benchmarks. Uses a fine-grained mixture-of-experts (MoE) architecture with 36B active parameters on any input. Pre-trained on 12T tokens of text and code data.',
  contextWindow: 32768,
  maxCompletionTokens: 2048,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  chatPrice: { input: 1080, output: 1080 },
},
{
  id: 'openpipe:sophosympatheia/midnight-rose-70b',
  label: '💾➜ Midnight Rose 70B 🎁',
  description: 'A merge with a complex family tree, this model was crafted for roleplaying and storytelling. Midnight Rose is a successor to Rogue Rose and Aurora Nights and improves upon them both. Features enhanced creative writing capabilities and produces lengthy output by default. Descends from earlier versions of Midnight Rose and Wizard Tulu Dolphin 70B.',
  contextWindow: 4096,
  maxCompletionTokens: 2048,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat],
  chatPrice: { input: 800, output: 800 },
},
{
  id: 'openpipe:01-ai/yi-large',
  label: '💾➜ 01.AI Yi Large 🎁',
  description: 'The Yi Large model was designed by 01.AI with knowledge search, data classification, human-like chat bots, and customer service in mind. Stands out for its multilingual proficiency, particularly in Spanish, Chinese, Japanese, German, and French.',
  contextWindow: 32768,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  chatPrice: { input: 3000, output: 3000 },
},
{
  id: 'openpipe:ai21/jamba-instruct',
  label: '💾➜ AI21 Jamba Instruct 🎁',
  description: 'The Jamba-Instruct model is an instruction-tuned variant of their hybrid SSM-Transformer Jamba model, specifically optimized for enterprise applications. Features a 256K context window for processing extensive information like financial reports or legal documents. Designed with enhanced safety features to ensure secure deployment in enterprise environments.',
  contextWindow: 256000,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-02',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  chatPrice: { input: 500, output: 700 },
},
{
  id: 'openpipe:anthropic/claude-3.5-sonnet-20240620',
  label: '💾➜ Claude 3.5 Sonnet 🎁',
  description: 'Claude 3.5 Sonnet delivers better-than-Opus capabilities, faster-than-Sonnet speeds, at the same Sonnet prices. Particularly excels at coding (autonomously writes, edits, and runs code), data science (navigates unstructured data while using multiple tools), visual processing (interpreting charts, graphs, and images), and agentic tasks (complex multi-step problem solving).',
  contextWindow: 200000,
  maxCompletionTokens: 8192,
  trainingDataCutoff: '2024-06',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn],
  chatPrice: { input: 3000, output: 15000 },
},
{
  id: 'openpipe:anthropic/claude-3.5-haiku',
  label: '💾➜ Claude 3.5 Haiku 🎁',
  description: 'Claude 3.5 Haiku is Anthropic\'s fastest and most compact model for near-instant responsiveness. Features quick and accurate targeted performance, making it ideal for applications requiring high throughput and low latency. Maintains high quality output while delivering significantly faster response times.',
  contextWindow: 200000,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-06',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn],
  chatPrice: { input: 250, output: 1250 },
},
{
  id: 'openpipe:anthropic/claude-3-opus',
  label: '💾➜ Claude 3 Opus 🎁',
  description: 'Claude 3 Opus is Anthropic\'s most powerful model for highly complex tasks. It boasts top-level performance, intelligence, fluency, and understanding. Features comprehensive multimodal capabilities and excels at tasks requiring sophisticated reasoning and analysis. Particularly strong in research, technical documentation, and complex problem-solving scenarios.',
  contextWindow: 200000,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn],
  chatPrice: { input: 15000, output: 75000 },
},
{
  id: 'openpipe:google/gemini-flash-1.5',
  label: '💾➜ Google Gemini Flash 1.5 🎁',
  description: 'Gemini 1.5 Flash is a foundation model that performs well at a variety of multimodal tasks such as visual understanding, classification, summarization, and content creation from image, audio and video. Designed for high-volume, high-frequency tasks where cost and latency matter. Achieves comparable quality to other Gemini Pro models at significantly reduced cost.',
  contextWindow: 1000000,
  maxCompletionTokens: 8192,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
  chatPrice: { input: 75, output: 300 },
},
{
  id: 'openpipe:google/gemini-flash-1.5-8b',
  label: '💾➜ Google Gemini Flash 1.5 8B 🎁',
  description: 'Gemini Flash 1.5 8B is optimized for speed and efficiency, offering enhanced performance in small prompt tasks like chat, transcription, and translation. Features reduced latency making it highly effective for real-time and large-scale operations. This model focuses on cost-effective solutions while maintaining high-quality results.',
  contextWindow: 1000000,
  maxCompletionTokens: 8192,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
  chatPrice: { input: 37.5, output: 150 },
},
{
  id: 'openpipe:google/gemini-flash-1.5-exp',
  label: '💾➜ Google Gemini Flash 1.5 Experimental 🎁',
  description: 'Gemini 1.5 Flash Experimental is an experimental version of the Gemini 1.5 Flash model. Features comprehensive vision capabilities, sophisticated function calling, and structured JSON output generation. Excels at complex reasoning tasks while maintaining faster inference speeds. Note: This model is experimental and not suited for production use-cases.',
  contextWindow: 1000000,
  maxCompletionTokens: 8192,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
  chatPrice: { input: 0, output: 0 },
},
{
  id: 'openpipe:google/gemini-2.0-flash-thinking-exp-1219:free',
  label: '💾➜ Gemini 2.0 Flash Thinking Experimental 🎁',
  description: 'Gemini 2.0 Flash Thinking Mode is an experimental model that\'s trained to generate the "thinking process" the model goes through as part of its response. Features stronger reasoning capabilities than the base Gemini 2.0 Flash model due to this explicit thought generation. Particularly useful for tasks requiring step-by-step reasoning or explanation.',
  contextWindow: 40000,
  maxCompletionTokens: 8000,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
  chatPrice: { input: 0, output: 0 },
},
{
  id: 'openpipe:sao10k/l3.3-euryale-70b',
  label: '💾➜ Sao10K Llama 3.3 Euryale 70B 🎁',
  description: 'Euryale L3.3 70B is a model focused on creative roleplay from Sao10k. Features enhanced narrative capabilities and character development. Successor to Euryale L3 70B v2.2 with improved context handling and creative writing abilities.',
  contextWindow: 131072,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat],
  chatPrice: { input: 700, output: 800 },
},
{
  id: 'openpipe:openai/o1',
  label: '💾➜ OpenAI o1 🎁',
  description: 'The latest and strongest model family from OpenAI, o1 is designed to spend more time thinking before responding. The o1 models are optimized for math, science, programming, and other STEM-related tasks. They consistently exhibit PhD-level accuracy on benchmarks in physics, chemistry, and biology. Features sophisticated multimodal capabilities and a 200K token context window.',
  contextWindow: 200000,
  maxCompletionTokens: 100000,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn],
  chatPrice: { input: 15000, output: 60000 },
},
{
  id: 'openpipe:eva-unit-01/eva-llama-3.33-70b',
  label: '💾➜ EVA Llama 3.33 70B 🎁',
  description: 'EVA Llama 3.33 70B is a roleplay and storywriting specialist model. It is a full-parameter finetune of Llama-3.3-70B-Instruct on mixture of synthetic and natural data. Uses Celeste 70B 0.1 data mixture, greatly expanding it to improve versatility, creativity and "flavor" of the resulting model.',
  contextWindow: 16384,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat],
  chatPrice: { input: 4000, output: 6000 },
},
{
  id: 'openpipe:x-ai/grok-2-vision-1212',
  label: '💾➜ xAI Grok 2 Vision 1212 🎁',
  description: 'Grok 2 Vision 1212 advances image-based AI with stronger visual comprehension, refined instruction-following, and multilingual support. From object recognition to style analysis, it empowers developers to build more intuitive, visually aware applications. Features enhanced steerability and reasoning capabilities for next-generation image solutions.',
  contextWindow: 32768,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
  chatPrice: { input: 2000, output: 10000 },
},
{
  id: 'openpipe:x-ai/grok-2-1212',
  label: '💾➜ xAI Grok 2 1212 🎁',
  description: 'Grok 2 1212 introduces significant enhancements to accuracy, instruction adherence, and multilingual support, making it a powerful and flexible choice for developers seeking a highly steerable, intelligent model. Features improved reasoning capabilities and enhanced context handling with a 131K token window.',
  contextWindow: 131072,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  chatPrice: { input: 2000, output: 10000 },
},
{
  id: 'openpipe:cohere/command-r-08-2024',
  label: '💾➜ Cohere Command R (08-2024) 🎁',
  description: 'Command R 08-2024 is an update of Command R with improved performance for multilingual retrieval-augmented generation (RAG) and tool use. Features better performance at math, code and reasoning tasks, competitive with the previous version of the larger Command R+ model.',
  contextWindow: 128000,
  maxCompletionTokens: 4000,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  chatPrice: { input: 142.5, output: 570 },
},
{
  id: 'openpipe:cohere/command-r-plus-08-2024',
  label: '💾➜ Cohere Command R+ (08-2024) 🎁',
  description: 'Command R+ 08-2024 is an update of Command R+ with roughly 50% higher throughput and 25% lower latencies compared to the previous version, while keeping the hardware footprint the same. Features enhanced performance across a wide range of tasks while maintaining efficiency.',
  contextWindow: 128000,
  maxCompletionTokens: 4000,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  chatPrice: { input: 2375, output: 9500 },
},
{
  id: 'openpipe:qwen/qwen-2-vl-72b-instruct',
  label: '💾➜ Qwen2-VL 72B Instruct 🎁',
  description: 'Qwen2 VL 72B is a multimodal LLM with state-of-the-art understanding of images of various resolution & ratio. Features ability to understand videos over 20 minutes long, agent capabilities for operating mobile devices and robots based on visual input, and multilingual support for text understanding in images across European languages, Japanese, Korean, Arabic, Vietnamese, etc.',
  contextWindow: 4096,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
  chatPrice: { input: 400, output: 400 },
},
{
  id: 'openpipe:qwen/qwen-2-vl-7b-instruct',
  label: '💾➜ Qwen2-VL 7B Instruct 🎁',
  description: 'Qwen2 VL 7B is the smaller variant of Qwen\'s multimodal LLM family. Features the same capabilities as the 72B model including state-of-the-art visual understanding, video comprehension, and multilingual support for text in images. Optimized for efficiency while maintaining strong performance on visual tasks.',
  contextWindow: 4096,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
  chatPrice: { input: 100, output: 100 },
},
{
  id: 'openpipe:google/gemini-flash-1.5-8b-exp',
  label: '💾➜ Google Gemini Flash 1.5 8B Experimental 🎁',
  description: 'Gemini Flash 1.5 8B Experimental is an experimental, 8B parameter version of the Gemini Flash 1.5 model. Features multimodal capabilities and optimized performance for speed and efficiency. Note: This model is currently experimental and not suitable for production use-cases.',
  contextWindow: 1000000,
  maxCompletionTokens: 8192,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
  chatPrice: { input: 0, output: 0 },
},
{
  id: 'openpipe:perplexity/llama-3-sonar-large-32k-chat',
  label: '💾➜ Perplexity Llama3 Sonar 70B 🎁',
  description: 'Llama3 Sonar is Perplexity\'s latest model family. It surpasses their earlier Sonar models in cost-efficiency, speed, and performance. Features enhanced reasoning capabilities and improved context handling with a 32K token window.',
  contextWindow: 32768,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  chatPrice: { input: 1000, output: 1000 },
},
{
  id: 'openpipe:perplexity/llama-3-sonar-large-32k-online',
  label: '💾➜ Perplexity Llama3 Sonar 70B Online 🎁',
  description: 'Llama3 Sonar is Perplexity\'s latest model family. This is the online version with internet access, focused on delivering helpful, up-to-date, and factual responses. Features enhanced reasoning capabilities and improved context handling with a 28K token window.',
  contextWindow: 28000,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  chatPrice: { input: 1000, output: 1000 },
},
{
  id: 'openpipe:perplexity/llama-3-sonar-small-32k-chat',
  label: '💾➜ Perplexity Llama3 Sonar 8B 🎁',
  description: 'Llama3 Sonar is Perplexity\'s latest model family. This is their 8B parameter variant, offering an efficient balance of performance and speed. Features enhanced reasoning capabilities and improved context handling with a 32K token window.',
  contextWindow: 32768,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  chatPrice: { input: 200, output: 200 },
},
{
  id: 'openpipe:perplexity/llama-3-sonar-small-32k-online',
  label: '💾➜ Perplexity Llama3 Sonar 8B Online 🎁',
  description: 'Llama3 Sonar is Perplexity\'s latest model family. This is the online version of their 8B parameter model with internet access, focused on delivering helpful, up-to-date, and factual responses. Features enhanced reasoning capabilities and improved context handling with a 28K token window.',
  contextWindow: 28000,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  chatPrice: { input: 200, output: 200 },
},
{
  id: 'openpipe:perplexity/llama-3-sonar-medium-32k-chat',
  label: '💾➜ Perplexity Llama3 Sonar 34B 🎁',
  description: 'Llama3 Sonar is Perplexity\'s latest model family. This is their 34B parameter variant, offering a balanced compromise between the 8B and 70B models. Features enhanced reasoning capabilities and improved context handling with a 32K token window.',
  contextWindow: 32768,
  maxCompletionTokens: 4096,
  trainingDataCutoff: '2024-01',
  interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  chatPrice: { input: 600, output: 600 },
},

  {
    id: 'openpipe:openrouter/openai/o1-preview',
    label: '💾➜ O1 Preview',
    description: 'The latest and strongest model family from OpenAI, o1 is designed to spend more time thinking before responding. The o1 model series is trained with large-scale reinforcement learning to reason using chain of thought. \n\nThe o1 models are optimized for math, science, programming, and other STEM-related tasks. They consistently exhibit PhD-level accuracy on benchmarks in physics, chemistry, and biology. Learn more in the [launch announcement](https://openai.com/o1).\n',
    contextWindow: 200000,
    maxCompletionTokens: 100000,
    trainingDataCutoff: '2024-09',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 15000000, output: 60000000 },
    benchmark: { cbaElo: 1300 },
  },

  {
    id: 'openpipe:openrouter/openai/o1-mini',
    label: '💾➜ O1 Mini',
    description: 'The latest and strongest model family from OpenAI, o1 is designed to spend more time thinking before responding.\n\nThe o1 models are optimized for math, science, programming, and other STEM-related tasks. They consistently exhibit PhD-level accuracy on benchmarks in physics, chemistry, and biology. Learn more in the [launch announcement](https://openai.com/o1).\n\nNote: This model is currently experimental and not suitable for production use-cases, and may be heavily rate-limited.',
    contextWindow: 128000,
    maxCompletionTokens: 65536,
    trainingDataCutoff: '2024-09',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 3000000, output: 12000000 },
    benchmark: { cbaElo: 1200 },
  },

  {
    id: 'openpipe:groqcloud/gemma2-9b-it',
    label: '💾➜ Gemma 2 9B Instruct 🎁',
    description: 'Gemma 2 9B developed by Google with a context window of 8,192 tokens. Supports tool use.',
    contextWindow: 8192,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-01',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0, output: 0 },
  },

  {
    id: 'openpipe:groqcloud/llama-3.3-70b-versatile',
    label: '💾➜ Llama 3.3 70B Versatile 🎁',
    description: 'The Meta Llama 3.3 multilingual large language model (LLM) is a pretrained and instruction tuned generative model in 70B (text in/text out). The Llama 3.3 instruction tuned text only model is optimized for multilingual dialogue use cases and outperforms many of the available open source and closed chat models on common industry benchmarks.\n\nSupported languages: English, German, French, Italian, Portuguese, Hindi, Spanish, and Thai.',
    contextWindow: 131072,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-03',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 0, output: 0 },
  },

  {
    id: 'openpipe:groqcloud/llama-3.1-8b-instant',
    label: '💾➜ Llama 3.1 8B Instant 🎁',
    description: 'Meta\'s latest class of model (Llama 3.1) launched with a variety of sizes & flavors. This 8B instruct-tuned version was optimized for high quality dialogue usecases.\n\nIt has demonstrated strong performance compared to leading closed-source models in human evaluations.',
    contextWindow: 131072,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-02',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0, output: 0 },
  },

  {
    id: 'openpipe:groqcloud/mixtral-8x7b-32768',
    label: '💾➜ Mixtral 8x7B 32K 🎁',
    description: 'Mixtral 8x7B model with 32K context window, combining multiple expert models.',
    contextWindow: 32768,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-01',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.0, output: 0.0 },
  },

  {
    id: 'openpipe:groqcloud/llama3-70b-8192',
    label: '💾➜ Llama 3 70B 8K 🎁',
    description: 'Llama 3 70B model with 8K context window.',
    contextWindow: 8192,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-01',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.0, output: 0.0 },
  },

  {
    id: 'openpipe:groqcloud/llama3-8b-8192',
    label: '💾➜ Llama 3 8B 8K 🎁',
    description: 'Llama 3 8B model with 8K context window.',
    contextWindow: 8192,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-01',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.0, output: 0.0 },
  },

  {
    id: 'openpipe:groqcloud/llama-3.2-1b-preview',
    label: '💾➜ Llama 3.2 1B Preview 🎁',
    description: 'Preview version of Llama 3.2 1B model.',
    contextWindow: 8192,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-02',
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0.0, output: 0.0 },
  },

  {
    id: 'openpipe:groqcloud/llama-3.2-3b-preview',
    label: '💾➜ Llama 3.2 3B Preview 🎁',
    description: 'Preview version of Llama 3.2 3B model.',
    contextWindow: 8192,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-02',
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0.0, output: 0.0 },
  },

  {
    id: 'openpipe:groqcloud/llama-3.2-11b-vision-preview',
    label: '💾➜ Llama 3.2 11B Vision Preview 🎁',
    description: 'Preview version of Llama 3.2 11B model with vision capabilities.',
    contextWindow: 8192,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-02',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    chatPrice: { input: 0.0, output: 0.0 },
  },

  {
    id: 'openpipe:groqcloud/llama-3.2-90b-vision-preview',
    label: '💾➜ Llama 3.2 90B Vision Preview 🎁',
    description: 'Preview version of Llama 3.2 90B model with vision capabilities.',
    contextWindow: 8192,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-02',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    chatPrice: { input: 0.0, output: 0.0 },
  },

  {
    id: 'openpipe:openrouter/google/gemini-flash-1.5',
    label: '💾➜ Google Gemini Flash 1.5',
    description: 'Optimized for speed and efficiency, designed for high-volume tasks at scale with extensive context handling capabilities.',
    contextWindow: 1000000,
    maxCompletionTokens: 1000000,
    trainingDataCutoff: '2024-01',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 0.075, output: 0.3 },
  },

  {
    id: 'openpipe:openrouter/openchat/openchat-7b',
    label: '💾➜ OpenChat 7B',
    description: 'Open source model that outperforms ChatGPT-3.5 on several benchmarks. Uses SFT and RLFT for alignment with human goals.',
    contextWindow: 32768,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-01',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.0, output: 0.0 },
  },

  {
    id: 'openpipe:openrouter/cohere/command-r-plus',
    label: '💾➜ Cohere Command R+',
    description: 'Advanced enterprise-grade model with strong performance across various tasks.',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-01',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 2.85, output: 14.25 },
  },

  {
    id: 'openpipe:openrouter/perplexity/llama-3.1-sonar-small-128k-online',
    label: '💾➜ Perplexity Sonar Small 128k',
    description: 'Part of Perplexity\'s latest Sonar model family with real-time information access capabilities.',
    contextWindow: 127000,
    maxCompletionTokens: 127000,
    trainingDataCutoff: '2024-01',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 1.0, output: 1.0 },
  },

  {
    id: 'openpipe:openrouter/mistralai/ministral-8b',
    label: '💾➜ Mistral Ministral 8B',
    description: 'Small-scale model suitable for edge devices with strong performance in knowledge retrieval and common-sense reasoning.',
    contextWindow: 131072,
    maxCompletionTokens: 131072,
    trainingDataCutoff: '2024-01',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.1, output: 0.1 },
  },

  /* OpenPipe models - by default it's OpenAI models, through the proxy service. */

  // DeepSeek models
  {
    id: 'openpipe:openrouter/deepseek/deepseek-chat',
    label: '💾➜ DeepSeek V3',
    description: 'DeepSeek-V3 is the latest model from the DeepSeek team, building upon the instruction following and coding abilities of the previous versions. Pre-trained on diverse data including code, academic papers, and general knowledge. Features strong performance in code generation and technical tasks.',
    contextWindow: 64000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2023-12',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 550000, output: 2190000 },
  },

  {
    id: 'openpipe:openrouter/qwen/qvq-72b-preview',
    label: '💾➜ Qwen QvQ 72B Preview',
    description: 'Qwen QvQ 72B is an experimental research model developed by the Qwen team. It features a 128K context window and demonstrates strong performance in reasoning, coding, and creative tasks. The model has been optimized for both efficiency and accuracy.',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-12',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 250000, output: 500000 },
  },

  {
    id: 'openpipe:totalgpt/inflatebot-MN-12B-Mag-Mell-R1',
    label: '💾➜ InflateBot MN 12B Mag-Mell 🎁',
    description: 'A Mistral-based 12B parameter model specifically optimized for creative writing and fictional content generation. Features enhanced narrative capabilities and strong ChatML formatting support. The model excels at maintaining consistent character voices and generating engaging storylines.',
    contextWindow: 32768,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-12',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 150000, output: 250000 },
  },

  {
    id: 'openpipe:totalgpt/Sao10K-72B-Qwen2.5-Kunou-v1-FP8-Dynamic',
    label: '💾➜ Sao10K Qwen2.5 72B Kunou 🎁',
    description: 'Advanced 72B parameter model based on Qwen2.5 architecture with 128K context support. Features FP8 dynamic quantization for efficient deployment while maintaining high performance. Optimized for both general dialogue and specialized tasks like coding and analysis.',
    contextWindow: 128000,
    maxCompletionTokens: 8192,
    trainingDataCutoff: '2024-12',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 250000, output: 500000 },
  },

  {
    id: 'openpipe:totalgpt/Sao10K-L3.3-70B-Euryale-v2.3-FP8-Dynamic',
    label: '💾➜ Sao10K Llama 3.3 70B Euryale 🎁',
    description: 'Advanced Llama 3.3-based 70B parameter model with 128K context window. Features enhanced creative capabilities and FP8 dynamic quantization for efficient deployment. Particularly strong in narrative generation and maintaining context over long sequences.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    trainingDataCutoff: '2024-12',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 200000, output: 400000 },
  },

  {
    id: 'openpipe:totalgpt/Llama-3.3-70B-Instruct-FP8-Dynamic',
    label: '💾➜ Meta Llama 3.3 70B Instruct FP8 🎁',
    description: 'Advanced multilingual model with 128K context window, trained on over 15 trillion tokens. Features optimized FP8 dynamic quantization for efficient deployment while maintaining high performance. Excels at instruction following and complex reasoning tasks.',
    contextWindow: 128000,
    maxCompletionTokens: 2048,
    trainingDataCutoff: '2023-12',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 200000, output: 400000 },
  },

  {
    id: 'openpipe:totalgpt/anthracite-org-magnum-v2-72b-FP8-Dynamic',
    label: '💾➜ Anthracite Magnum v2 72B 🎁',
    description: 'High-performance 72B parameter model based on Qwen2, optimized for multilingual communication and complex reasoning. Features FP8 dynamic quantization for efficient deployment. Achieves 75.60% on IFEval and 57.85% on BBH benchmarks. Particularly strong in mathematical reasoning and structured output generation.',
    contextWindow: 16384,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-01',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 250000, output: 500000 },
    benchmark: { cbaElo: 1250 },
  },

  {
    id: 'openpipe:totalgpt/anthracite-org-magnum-v4-72b-FP8-Dynamic',
    label: '💾➜ Anthracite Magnum v4 72B 🎁',
    description: 'Advanced 72B parameter model based on Qwen2.5, optimized with FP8 dynamic quantization. Features 32K context window and enhanced reasoning capabilities. Designed to replicate Claude 3 prose quality and excels at complex problem-solving tasks. Achieves state-of-the-art performance on multiple benchmarks.',
    contextWindow: 32768,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-01',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 250000, output: 500000 },
    benchmark: { cbaElo: 1270 },
  },

  {
    id: 'openpipe:totalgpt/Hermes-3-Llama-3.1-70B-FP8',
    label: '💾➜ NousResearch Hermes 3 70B 🎁',
    description: 'Advanced reasoning model based on Llama 3.1 architecture, optimized with FP8 quantization for efficient deployment. Features strong capabilities in structured outputs and function calling. Excels at complex reasoning tasks and maintains high accuracy in technical domains. Supports 128K context window for handling extensive documents.',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-01',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 200000, output: 400000 },
  },

  {
    id: 'openpipe:totalgpt/Qwen-QwQ-32B-Preview',
    label: '💾➜ Qwen QwQ 32B Preview 🎁',
    description: 'Specialized 32B parameter model with strong capabilities in mathematics, programming, and scientific reasoning. Features 32K context window and optimized attention mechanisms. Particularly excels at technical documentation and code generation tasks. Achieves high accuracy in mathematical computations and logical reasoning.',
    contextWindow: 32768,
    maxCompletionTokens: 8000,
    trainingDataCutoff: '2024-01',
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 150000, output: 300000 },
  },

  {
    id: 'openpipe:totalgpt/Infermatic-MN-12B-Inferor-v0.0',
    label: '💾➜ Infermatic MN 12B Inferor 🎁',
    description: 'Mistral-based 12B parameter model optimized with BFloat16 precision. Features advanced text generation capabilities through sophisticated model merging techniques. Particularly strong in maintaining narrative consistency and generating creative content. Supports 32K context window for extended conversations.',
    contextWindow: 32768,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-01',
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 100000, output: 200000 },
  },

  {
    id: 'openpipe:totalgpt/UnslopNemo-12B-v4.1',
    label: '💾➜ TheDrummer UnslopNemo 12B v4.1 🎁',
    description: 'General-purpose 12B parameter language model optimized for versatile text generation and processing tasks. Features enhanced dialogue capabilities and strong performance in creative writing scenarios. Supports 32K context window for handling longer conversations and documents.',
    contextWindow: 32768,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-01',
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 100000, output: 200000 },
  },

  {
    id: 'openpipe:totalgpt/TheDrummer-Anubis-70B-v1-FP8-Dynamic',
    label: '💾➜ TheDrummer Anubis 70B v1 🎁',
    description: 'Advanced 70B parameter model optimized with FP8 dynamic quantization. Specifically designed for creative writing and roleplay scenarios with enhanced narrative capabilities. Features 32K context window for maintaining long-term story coherence and character consistency. Excels at generating immersive and engaging content.',
    contextWindow: 32768,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-01',
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 200000, output: 400000 },
  },

  {
    id: 'openpipe:totalgpt/Qwen2.5-72B-Instruct-Turbo',
    label: '💾➜ Qwen 2.5 72B Instruct Turbo 🎁',
    description: 'High-performance 72B parameter model optimized for speed and efficiency. Features state-of-the-art instruction following capabilities and enhanced reasoning. Achieves 93.1 on RULER benchmark and excels in long-text tasks with 100% accuracy in 1M length Passkey Retrieval. Particularly strong in technical and analytical tasks.',
    contextWindow: 32768,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-09',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 250000, output: 500000 },
    benchmark: { cbaElo: 1275 },
  },

  {
    id: 'openpipe:totalgpt/Midnight-Miqu-70B-v1.5',
    label: '💾➜ Midnight Miqu 70B v1.5 🎁',
    description: 'Creative writing focused 70B parameter model with exceptional performance in storytelling and roleplaying. Features advanced narrative generation capabilities and strong character consistency. Achieves consistent 77+ scores on EQ-Bench, demonstrating high emotional intelligence in dialogue generation.',
    contextWindow: 32768,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-01',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Json],
    chatPrice: { input: 200000, output: 400000 },
    benchmark: { cbaElo: 1260 },
  },

  {
    id: 'openpipe:totalgpt/WizardLM-2-8x22B',
    label: '💾➜ WizardLM 2 8x22B 🎁',
    description: 'Advanced reasoning model with exceptional performance in technical tasks. Features sophisticated mixture-of-experts architecture for enhanced problem-solving. Achieves 9.2 in reasoning, 9.4 in technical analysis, and 9.3 in language understanding benchmarks. Particularly excels at complex mathematical and scientific tasks.',
    contextWindow: 65536,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-01',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 150000, output: 300000 },
    benchmark: { cbaElo: 1280 },
  },

  {
    id: 'openpipe:totalgpt/alpindale-WizardLM-2-8x22B',
    label: '💾➜ Alpindale WizardLM 2 8x22B 🎁',
    description: 'Specialized 141B parameter model fine-tuned for storytelling and roleplay. Features advanced narrative generation capabilities and strong reasoning performance. Achieves 52.72% on IFEval and 48.58% on BBH benchmarks. Particularly excels at maintaining long-term narrative coherence and character development.',
    contextWindow: 16384,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-01',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 200000, output: 400000 },
    benchmark: { cbaElo: 1265 },
  },

  {
    id: 'openpipe:totalgpt/lama-3-TenyxChat-DaybreakStorywriter-70B-fp8-dynamic',
    label: '💾➜ TenyxChat Daybreak 70B 🎁',
    description: 'Llama 3-based storytelling model optimized with fp8 dynamic quantization for efficient deployment. Features enhanced narrative generation capabilities and strong character development. Particularly excels at maintaining consistent story arcs and dialogue across extended sequences.',
    contextWindow: 8192,
    maxCompletionTokens: 2048,
    trainingDataCutoff: '2023-12',
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 200000, output: 400000 },
  },

  {
    id: 'openpipe:totalgpt/Sao10K-L3.1-70B-Hanami-x1',
    label: '💾➜ Sao10K Llama 3.1 70B Hanami 🎁',
    description: 'Advanced 70B parameter model based on Llama 3.1 architecture with extended context handling capabilities. Features sophisticated attention mechanisms and enhanced reasoning abilities. Particularly strong in maintaining context over long sequences and handling complex multi-step tasks.',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-01',
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 3000000, output: 3000000 },
  },

  {
    id: 'openpipe:totalgpt/rAIfle-SorcererLM-8x22b-bf16',
    label: '💾➜ rAIfle SorcererLM 8x22B BF16 🎁',
    description: 'Advanced 141B parameter model optimized for roleplay and creative writing. Based on WizardLM-2 with BF16 precision and enhanced vocabulary capabilities. Features sophisticated narrative generation and strong character development abilities. Particularly excels at maintaining consistent character voices and generating engaging dialogue.',
    contextWindow: 16384,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-01',
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 200000, output: 400000 },
  },

  {
    id: 'openpipe:openrouter/openai/chatgpt-4o-latest',
    label: '💾➜ ChatGPT-4o',
    description: 'OpenAI ChatGPT 4o represents the latest iteration of GPT-4, continuously updated by OpenAI. Features 128K context window and advanced multimodal capabilities including vision, function calling, and structured JSON outputs. Demonstrates exceptional performance across a wide range of tasks from creative writing to technical analysis.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    trainingDataCutoff: '2024-08',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Vision],
    chatPrice: { input: 5000000, output: 15000000 },
  },

  {
    id: 'openpipe:openrouter/anthropic/claude-3.5-sonnet',
    label: '💾➜ Claude 3.5 Sonnet',
    description: 'Latest Claude model delivering exceptional performance with better-than-Opus capabilities and faster-than-Sonnet speeds. Features 200K context window and advanced multimodal understanding. Excels at complex reasoning tasks and demonstrates strong capabilities in code generation, analysis, and creative writing.',
    contextWindow: 200000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-10',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Vision],
    chatPrice: { input: 3000000, output: 15000000 },
  },

  {
    id: 'openpipe:openrouter/anthropic/claude-3-opus',
    label: '💾➜ Claude 3 Opus',
    description: 'Most advanced Claude model demonstrating exceptional performance across all benchmarks (88.2 MMLU, 95.4 HellaSwag). Features 200K context window and sophisticated multimodal capabilities. Excels at complex reasoning, technical analysis, and creative tasks. Demonstrates strong capabilities in code generation, mathematical problem-solving, and scientific research.',
    contextWindow: 200000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2023-08',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Vision],
    chatPrice: { input: 15000000, output: 75000000 },
    benchmark: { cbaElo: 1350 },
  },

  {
    id: 'openpipe:openrouter/google/gemini-2.0-flash-exp:free',
    label: '💾➜ Google Gemini 2.0 Flash Exp 🎁',
    description: 'Advanced experimental model from Google featuring sophisticated multimodal understanding and enhanced reasoning capabilities. Excels at coding tasks with strong performance in multiple programming languages. Features complex instruction following and structured output generation. Optimized for fast inference while maintaining high accuracy.',
    contextWindow: 32768,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-01',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 0, output: 0 },
  },

  {
    id: 'openpipe:openrouter/google/gemini-exp-1206:free',
    label: '💾➜ Google Gemini Exp 1206 🎁',
    description: 'Experimental version of the Gemini model series featuring enhanced text processing and reasoning capabilities. Demonstrates strong performance in natural language understanding tasks and complex problem-solving. Optimized for efficient processing of long-form content with improved context retention.',
    contextWindow: 32768,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-01',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0, output: 0 },
  },

  {
    id: 'openpipe:openrouter/google/gemini-exp-1121:free',
    label: '💾➜ Google Gemini Exp 1121 🎁',
    description: 'Early experimental version of the Gemini model series showcasing foundational improvements in text generation and processing. Features enhanced natural language understanding and generation capabilities. Particularly effective at maintaining coherence in extended conversations and handling complex instructions.',
    contextWindow: 32768,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-01',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0, output: 0 },
  },

  {
    id: 'openpipe:openrouter/google/learnlm-1.5-pro-experimental:free',
    label: '💾➜ Google LearnLM 1.5 Pro Exp 🎁',
    description: 'Specialized experimental model optimized for educational and learning applications. Features advanced text processing capabilities and enhanced understanding of academic concepts. Particularly strong in explaining complex topics, generating educational content, and adapting explanations based on context. Supports interactive learning through dynamic response generation.',
    contextWindow: 32768,
    maxCompletionTokens: 4096,
    trainingDataCutoff: '2024-01',
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0, output: 0 },
  },

  // OpenAI models: these work
  {
    id: 'gpt-4o-mini-2024-07-18',
    label: '💾➜ GPT-4o Mini (2024-07-18)',
    description: 'Efficient and affordable model optimized for fast, lightweight tasks. Features superior performance compared to GPT-3.5 Turbo while maintaining lower costs. Supports multimodal capabilities including vision, function calling, and structured JSON outputs. Particularly effective for rapid prototyping and high-throughput applications.',
    contextWindow: 128000,
    maxCompletionTokens: 16384,
    trainingDataCutoff: 'Oct 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: _knownOpenAIChatModels.find(m => m.idPrefix === 'gpt-4o-mini-2024-07-18')?.chatPrice,
    benchmark: { cbaMmlu: 82.0 },
  },
  {
    id: 'gpt-4o-2024-05-13',
    label: '💾➜ GPT-4o (2024-05-13)',
    description: 'Advanced multimodal flagship model offering superior performance at lower cost than GPT-4 Turbo. Features comprehensive vision capabilities, sophisticated function calling, and structured JSON output generation. Excels at complex reasoning tasks while maintaining faster inference speeds. Particularly strong in technical analysis and creative problem-solving.',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Oct 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: _knownOpenAIChatModels.find(m => m.idPrefix === 'gpt-4o-2024-05-13')?.chatPrice,
    benchmark: { cbaElo: 1287 },
  },
  {
    id: 'gpt-3.5-turbo-1106',
    label: '💾➜ GPT-3.5 Turbo (1106)',
    description: 'November 2023 version of GPT-3.5 Turbo featuring improved instruction following and enhanced function calling capabilities. Offers reliable performance for general-purpose tasks with efficient resource utilization. Particularly suitable for applications requiring high throughput and cost-effectiveness.',
    contextWindow: 16385,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Sep 2021',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: _knownOpenAIChatModels.find(m => m.idPrefix === 'gpt-3.5-turbo-1106')?.chatPrice,
    benchmark: { cbaElo: 1072 },
  },
  {
    id: 'gpt-3.5-turbo-0125',
    label: '💾➜ GPT-3.5 Turbo (0125)',
    description: 'The latest GPT-3.5 Turbo model with higher accuracy at responding in requested formats',
    contextWindow: 16385,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Sep 2021',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: _knownOpenAIChatModels.find(m => m.idPrefix === 'gpt-3.5-turbo-0125')?.chatPrice,
    benchmark: { cbaElo: 1105 },
  },

  // Not supported yet "We don't support streaming responses for chat completions with Anthropic yet. Please email us at support@openpipe.ai if this is a feature you need!"
  // {
  //   id: 'claude-3-5-sonnet-20240620',
  //   label: '💾➜ Claude 3.5 Sonnet',
  //   description: 'The most intelligent Claude model',
  //   contextWindow: 200000, // Characters
  //   maxCompletionTokens: 8192,
  //   trainingDataCutoff: 'Apr 2024',
  //   interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
  //   pricing: { input: 3, output: 15 },
  // },

  // Default finetune, not available at the onset
  // {
  //   id: 'mistral-ft-optimized-1227',
  //   label: 'OpenPipe · Mistral FT Optimized',
  //   description: 'OpenPipe optimized Mistral fine-tuned model',
  //   contextWindow: 32768, // Assuming similar to Mixtral, as it's Mistral-based
  //   interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn], // Assuming similar to Mixtral
  // },

  // Finetune-able models, but not present
  // {
  //   id: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
  //   label: 'Meta-Llama 3.1 · 8B Instruct',
  //   description: 'Meta-Llama 3.1 8B Instruct model',
  //   contextWindow: 128000, // Inferred from Llama 3 models in the original code
  //   maxCompletionTokens: 4096, // Inferred from Llama 3 models in the original code
  //   interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json], // Inferred from Llama 3 models
  // },
  // {
  //   id: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
  //   label: 'Meta-Llama 3.1 · 70B Instruct',
  //   description: 'Meta-Llama 3.1 70B Instruct model',
  //   contextWindow: 128000, // Inferred from Llama 3 models in the original code
  //   maxCompletionTokens: 4096, // Inferred from Llama 3 models in the original code
  //   interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json], // Inferred from Llama 3 models
  // },
  // {
  //   id: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
  //   label: 'Mixtral · 8x7B Instruct v0.1',
  //   description: 'Mixtral 8x7B Instruct v0.1 model',
  //   contextWindow: 32768, // Inferred from Mixtral model in the original code
  //   interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn], // Inferred from Mixtral model
  // },

];

const openPipeModelFamilyOrder = [
  'gpt-4o', 'gpt-3.5-turbo', 'mistral-ft', 'meta-llama', 'mistralai', '',
];

export function openPipeModelDescriptions() {
  return _knownOpenPipeChatModels;
}

export function openPipeModelSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  const aPrefixIndex = openPipeModelFamilyOrder.findIndex(prefix => a.id.startsWith(prefix));
  const bPrefixIndex = openPipeModelFamilyOrder.findIndex(prefix => b.id.startsWith(prefix));
  // Sort by family
  if (aPrefixIndex !== bPrefixIndex)
    return aPrefixIndex - bPrefixIndex;
  // Then by reverse label (newer versions first)
  return b.label.localeCompare(a.label);
}

export function openPipeModelToModelDescriptions(wireModel: object): ModelDescriptionSchema {
  // parse the model
  const model = wireOpenPipeModelOutputSchema.parse(wireModel);

  // note: model.id is a UUID, but when making the requests, this is the id we use
  const namedId = `openpipe:${model.name}`;

  // parse the ISO strings
  let created: number | undefined;
  let updated: number | undefined;
  try {
    created = Date.parse(model.created) || undefined;
    updated = Date.parse(model.updated) || undefined;
  } catch (e) {
    // .. prevent issues
  }

  // patch label and description based on the `.openpipe` field
  let label = 'OpenPipe · ' + model.name;
  let description = model.description || 'Fine-tuned model.';
  switch (model.openpipe?.status) {
    case 'PENDING':
      label = `🟦 ${label} (PENDING)`;
      break;
    case 'TRAINING':
      label = `🟦 ${label} (TRAINING)`;
      break;
    case 'DEPLOYED':
      label = `🟩 ${label}`;
      break;
    case 'ERROR':
      label = `🟥 ${label} (ERROR)`;
      break;
    case 'DEPRECATED':
      label = `🟨 ${label} (DEPRECATED)`;
      break;
  }

  if (model.openpipe?.baseModel)
    description += `\n\nBased on: ${model.openpipe.baseModel}`;
  if (model.openpipe?.datasetId)
    description += `\nDataset Id: ${model.openpipe.datasetId}`;
  if (model.openpipe?.errorMessage)
    description += `\n\nError: ${model.openpipe.errorMessage}\n`;
  description += `\n\nUUID: ${model.id}`;


  const manualMapping: ManualMapping = {
    idPrefix: namedId,
    label,
    description,
    contextWindow: model.contextWindow,
    maxCompletionTokens: model.maxCompletionTokens,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
  };

  if (model.pricing) {
    manualMapping.chatPrice = {
      input: model.pricing.chatIn,
      output: model.pricing.chatOut,
    };
  }

  return fromManualMapping([], namedId, created, updated, manualMapping);
}


// [OpenRouter]

const orOldModelIDs = [
  // Older OpenAI models
  'openai/gpt-3.5-turbo-0301', 'openai/gpt-3.5-turbo-0613', 'openai/gpt-4-0314', 'openai/gpt-4-32k-0314',
  // Older Anthropic models
  'anthropic/claude-1', 'anthropic/claude-1.2', 'anthropic/claude-instant-1.0', 'anthropic/claude-instant-1.1',
  'anthropic/claude-2', 'anthropic/claude-2:beta', 'anthropic/claude-2.0', 'anthropic/claude-2.1', 'anthropic/claude-2.0:beta',
];

const orModelFamilyOrder = [
  // Leading models/organizations (based on capabilities and popularity)
  'anthropic/', 'openai/', 'google/', 'mistralai/', 'meta-llama/',
  // Other major providers
  'x-ai/', 'amazon/', 'cohere/', 'nvidia/', 'inflection/',
  // Specialized/AI companies
  'perplexity/', 'phind/', 'qwen/', 'deepseek/',
  // Research/open models
  'microsoft/', 'nousresearch/', 'openchat/', 'huggingfaceh4/',
  // Community/other providers
  // 'gryphe/', 'thedrummer/', 'undi95/', 'cognitivecomputations/', 'sao10k/',
];

export function openRouterModelFamilySortFn(a: { id: string }, b: { id: string }): number {
  const aPrefixIndex = orModelFamilyOrder.findIndex(prefix => a.id.startsWith(prefix));
  const bPrefixIndex = orModelFamilyOrder.findIndex(prefix => b.id.startsWith(prefix));

  // If both have a prefix, sort by prefix first, and then alphabetically
  if (aPrefixIndex !== -1 && bPrefixIndex !== -1)
    return aPrefixIndex !== bPrefixIndex ? aPrefixIndex - bPrefixIndex : b.id.localeCompare(a.id);

  // If one has a prefix and the other doesn't, prioritize the one with prefix
  return aPrefixIndex !== -1 ? -1 : 1;
}

export function openRouterModelToModelDescription(wireModel: object): ModelDescriptionSchema {

  // parse the model
  const model = wireOpenrouterModelsListOutputSchema.parse(wireModel);

  // parse pricing
  const inputPrice = parseFloat(model.pricing.prompt);
  const outputPrice = parseFloat(model.pricing.completion);
  const chatPrice: ModelDescriptionSchema['chatPrice'] = {
    input: inputPrice ? inputPrice * 1000 * 1000 : 'free',
    output: outputPrice ? outputPrice * 1000 * 1000 : 'free',
    // image...
    // request...
  };
  const seemsFree = chatPrice.input === 'free' && chatPrice.output === 'free';

  // openrouter provides the fields we need as part of the model object
  let label = model.name || model.id.replace('/', ' · ');
  if (seemsFree)
    label += ' · 🎁'; // Free? Discounted?
  // label = label.replace('(self-moderated)', '🔓');

  // hidden: hide by default older models or models not in known families
  const hidden = orOldModelIDs.includes(model.id) || !orModelFamilyOrder.some(prefix => model.id.startsWith(prefix));

  return fromManualMapping([], model.id, undefined, undefined, {
    idPrefix: model.id,
    // latest: ...
    label,
    // created: ...
    // updated: ...
    description: model.description,
    contextWindow: model.context_length || 4096,
    maxCompletionTokens: model.top_provider.max_completion_tokens || undefined,
    // trainingDataCutoff: ...
    interfaces: [LLM_IF_OAI_Chat],
    // benchmark: ...
    chatPrice,
    hidden,
  });
}


// Groq - https://console.groq.com/docs/models

const _knownGroqModels: ManualMappings = [
  {
    isLatest: true,
    idPrefix: 'llama-3.1-405b-reasoning',
    label: 'Llama 3.1 · 405B',
    description: 'LLaMA 3.1 405B developed by Meta with a context window of 131,072 tokens. Supports tool use.',
    contextWindow: 131072,
    maxCompletionTokens: 8000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  },
  {
    isLatest: true,
    idPrefix: 'llama-3.1-70b-versatile',
    label: 'Llama 3.1 · 70B',
    description: 'LLaMA 3.1 70B developed by Meta with a context window of 131,072 tokens. Supports tool use.',
    contextWindow: 131072,
    maxCompletionTokens: 8000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  },
  {
    isLatest: true,
    idPrefix: 'llama-3.1-8b-instant',
    label: 'Llama 3.1 · 8B',
    description: 'LLaMA 3.1 8B developed by Meta with a context window of 131,072 tokens. Supports tool use.',
    contextWindow: 131072,
    maxCompletionTokens: 8000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  },
  {
    idPrefix: 'llama3-groq-70b-8192-tool-use-preview',
    label: 'Llama 3 Groq · 70B Tool Use',
    description: 'LLaMA 3 70B Tool Use developed by Groq with a context window of 8,192 tokens. Optimized for tool use.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  },
  {
    idPrefix: 'llama3-groq-8b-8192-tool-use-preview',
    label: 'Llama 3 Groq · 8B Tool Use',
    description: 'LLaMA 3 8B Tool Use developed by Groq with a context window of 8,192 tokens. Optimized for tool use.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  },
  {
    idPrefix: 'llama3-70b-8192',
    label: 'Llama 3 · 70B',
    description: 'LLaMA3 70B developed by Meta with a context window of 8,192 tokens. Supports tool use.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    // isLegacy: true,
    hidden: true,
  },
  {
    idPrefix: 'llama3-8b-8192',
    label: 'Llama 3 · 8B',
    description: 'LLaMA3 8B developed by Meta with a context window of 8,192 tokens. Supports tool use.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    // isLegacy: true,
    hidden: true,
  },
  {
    idPrefix: 'mixtral-8x7b-32768',
    label: 'Mixtral 8x7B',
    description: 'Mixtral 8x7B developed by Mistral with a context window of 32,768 tokens. Supports tool use.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  },
  {
    idPrefix: 'gemma2-9b-it',
    label: 'Gemma 2 · 9B Instruct',
    description: 'Gemma 2 9B developed by Google with a context window of 8,192 tokens. Supports tool use.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  },
  {
    idPrefix: 'gemma-7b-it',
    label: 'Gemma 1.1 · 7B Instruct',
    description: 'Gemma 7B developed by Google with a context window of 8,192 tokens. Supports tool use.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  },
];

export function groqModelToModelDescription(_model: unknown): ModelDescriptionSchema {
  const model = wireGroqModelsListOutputSchema.parse(_model);
  return fromManualMapping(_knownGroqModels, model.id, model.created, undefined, {
    idPrefix: model.id,
    label: model.id.replaceAll(/[_-]/g, ' '),
    description: 'New Model',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  });
}

export function groqModelSortFn(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  // sort hidden at the end
  if (a.hidden && !b.hidden)
    return 1;
  if (!a.hidden && b.hidden)
    return -1;
  // sort as per their order in the known models
  const aIndex = _knownGroqModels.findIndex(base => a.id.startsWith(base.idPrefix));
  const bIndex = _knownGroqModels.findIndex(base => b.id.startsWith(base.idPrefix));
  if (aIndex !== -1 && bIndex !== -1)
    return aIndex - bIndex;
  return a.id.localeCompare(b.id);
}


// Helpers

export type ManualMapping = ({
  idPrefix: string,
  isLatest?: boolean,
  isPreview?: boolean,
  isLegacy?: boolean,
  symLink?: string
} & Omit<ModelDescriptionSchema, 'id' | 'created' | 'updated'>);

export type ManualMappings = ManualMapping[];

export function fromManualMapping(mappings: ManualMappings, id: string, created?: number, updated?: number, fallback?: ManualMapping, disableSymLink?: boolean): ModelDescriptionSchema {

  // find the closest known model, or fall back, or take the last
  const known = mappings.find(base => id === base.idPrefix)
    || mappings.find(base => id.startsWith(base.idPrefix))
    || fallback
    || mappings[mappings.length - 1];

  // label for symlinks
  let label = known.label;
  if (!disableSymLink && known.symLink && id === known.idPrefix)
    label = `🔗 ${known.label} → ${known.symLink/*.replace(known.idPrefix, '')*/}`;

  // check whether this is a partial map, which indicates an unknown/new variant
  const suffix = id.slice(known.idPrefix.length).trim();

  // full label
  label = label
    + (suffix ? ` [${suffix.replaceAll('-', ' ').trim()}]` : '')
    + (known.isLatest ? ' 🌟' : '')
    + (known.isLegacy ? /*' 💩'*/ ' [legacy]' : '');

  // set the date in YYYY-MM-DD format if available and requested
  // if (label.indexOf('{{Created}}') !== -1) {
  //   const targetDate = updated || created;
  //   if (targetDate)
  //     label = label.replace('{{Created}}', `(${new Date(targetDate * 1000).toISOString().slice(0, 10)})`);
  //   else
  //     label = label.replace('{{Created}}', '');
  // }

  // create the model description
  const md: ModelDescriptionSchema = {
    id,
    label,
    created: created || 0,
    updated: updated || created || 0,
    description: known.description,
    contextWindow: known.contextWindow,
    interfaces: known.interfaces,
  };

  // apply optional fields
  if (known.maxCompletionTokens)
    md.maxCompletionTokens = known.maxCompletionTokens;
  if (known.trainingDataCutoff)
    md.trainingDataCutoff = known.trainingDataCutoff;
  if (known.parameterSpecs)
    md.parameterSpecs = known.parameterSpecs;
  if (known.benchmark)
    md.benchmark = known.benchmark;
  if (known.chatPrice)
    md.chatPrice = known.chatPrice;
  if (known.hidden)
    md.hidden = true;

  return md;
}

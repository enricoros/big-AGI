// here for reference only - for future mapping of CBA scores to the model IDs
// const modelIdToPrefixMap: { [key: string]: string } = {
//   // Anthropic models
//   'Claude 3.5 Sonnet': 'claude-3-5-sonnet-20240620',
//   'Claude 3 Opus': 'claude-3-opus-20240229',
//   'Claude 3 Sonnet': 'claude-3-sonnet-20240229',
//   'Claude 3 Haiku': 'claude-3-haiku-20240307',
//   'Claude-2.1': 'claude-2.1',
//   'Claude-2.0': 'claude-2.0',
//   'Claude-1': '', // No exact match
//   'Claude-Instant-1': 'claude-instant-1.2', // Closest match
//
//   // Gemini models
//   'Gemini-1.5-Pro-Exp-0801': 'models/gemini-1.5-pro-latest', // Closest match
//   'Gemini Advanced App (2024-05-14)': '', // No exact match
//   'Gemini-1.5-Pro-001': 'models/gemini-1.5-pro-001',
//   'Gemini-1.5-Pro-Preview-0409': 'models/gemini-1.5-pro-latest', // Closest match
//   'Gemini-1.5-Flash-001': 'models/gemini-1.5-flash-001',
//   'Gemini App (2024-01-24)': '', // No exact match
//   'Gemini-1.0-Pro-001': 'models/gemini-1.0-pro-001',
//   'Gemini Pro': 'models/gemini-pro',
//
//   // OpenAI models (from the previous file)
//   'GPT-4o-2024-05-13': 'gpt-4o-2024-05-13',
//   'GPT-4o-mini-2024-07-18': 'gpt-4o-mini-2024-07-18',
//   'GPT-4-Turbo-2024-04-09': 'gpt-4-turbo-2024-04-09',
//   'GPT-4-1106-preview': 'gpt-4-1106-preview',
//   'GPT-4-0125-preview': 'gpt-4-0125-preview',
//   'GPT-4-0314': 'gpt-4-0314',
//   'GPT-4-0613': 'gpt-4-0613',
//   'GPT-3.5-Turbo-0613': 'gpt-3.5-turbo-0613',
//   'GPT-3.5-Turbo-0314': 'gpt-3.5-turbo-0314',
//   'GPT-3.5-Turbo-0125': 'gpt-3.5-turbo-0125',
//
//   // Mistral models (from the previous file)
//   'Mistral-Large-2402': 'mistral-large-2402',
//   'Mixtral-8x7b-Instruct-v0.1': 'mistralai/Mixtral-8x7B-Instruct-v0.1',
//
//   // Other models without matches
//   'Gemini-1.5-Pro-Exp-0801': '',
//   'Meta-Llama-3.1-405b-Instruct': '',
//   'Gemini-1.5-Pro-001': '',
//   'Meta-Llama-3.1-70b-Instruct': '',
//   'Yi-Large-preview': '',
//   'Deepseek-v2-API-0628': '',
//   'Gemma-2-27b-it': '',
//   'Yi-Large': '',
//   'Nemotron-4-340B-Instruct': '',
//   'GLM-4-0520': '',
//   'Llama-3-70b-Instruct': '',
//   'Reka-Core-20240501': '',
//   'Command R+': '',
//   'Gemma-2-9b-it': '',
//   'Qwen2-72B-Instruct': '',
//   'GLM-4-0116': '',
//   'Qwen-Max-0428': '',
//   'DeepSeek-Coder-V2-Instruct': '',
//   'Reka-Flash-Preview-20240611': '',
//   'Meta-Llama-3.1-8b-Instruct': '',
//   'Qwen1.5-110B-Chat': '',
//   'Yi-1.5-34B-Chat': '',
//   'Reka-Flash-21B-online': '',
//   'Llama-3-8b-Instruct': '',
//   'Command R': '',
//   'Reka-Flash-21B': '',
//   'Qwen1.5-72B-Chat': '',
//   'Mixtral-8x22b-Instruct-v0.1': '',
//   'Zephyr-ORPO-141b-A35b-v0.1': '',
//   'Qwen1.5-32B-Chat': '',
//   'Mistral-Next': '',
//   'Phi-3-Medium-4k-Instruct': '',
//   'Starling-LM-7B-beta': '',
//   'Yi-34B-Chat': '',
//   'Qwen1.5-14B-Chat': '',
//   'WizardLM-70B-v1.0': '',
//   'Tulu-2-DPO-70B': '',
//   'DBRX-Instruct-Preview': '',
//   'Phi-3-Small-8k-Instruct': '',
//   'Llama-2-70b-chat': '',
//   'OpenChat-3.5-0106': '',
//   'Vicuna-33B': '',
//   'Snowflake Arctic Instruct': '',
//   'Starling-LM-7B-alpha': '',
// };
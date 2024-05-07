/**
 * This is here because the API does not provide a list of available upstream models, and does not provide
 * descriptions for the models.
 * (nor does it reliably provide context window sizes - upstream bug: https://github.com/ollama/ollama/issues/1473)
 *
 <<<
 Can you modify the following data structure, according to the updated information from the attached
 web page(https://ollama.ai/library?sort=featured). Be very thorough, do not skip any lines, both in
 the provided file and in the web page. Add/remove to reflect the order in the web page, update
 the *description* and *pulls*, and preserve the existing *added* field on existing entries, or set
 it to 20240126 on new entries.
 >>>
 *
 * from: https://ollama.ai/library?sort=featured
 * Note: the default contextWindow in code is 8192, so we do not redefine that
 */
export const OLLAMA_BASE_MODELS: { [key: string]: { description: string, pulls: number, added?: string, contextWindow?: number } } = {
  'llama3': { description: 'Meta Llama 3: The most capable openly available LLM to date', pulls: 562300, added: '20240501' },
  'phi3': { description: 'Phi-3 Mini is a 3.8B parameters, lightweight, state-of-the-art open model by Microsoft.', pulls: 61800, added: '20240501' },
  'wizardlm2': { description: 'State of the art large language model from Microsoft AI with improved performance on complex chat, multilingual, reasoning and agent use cases.', pulls: 34400, added: '20240501' },
  'mistral': { description: 'The 7B model released by Mistral AI, updated to version 0.2.', pulls: 682700 },
  'gemma': { description: 'Gemma is a family of lightweight, state-of-the-art open models built by Google DeepMind. Updated to version 1.1', pulls: 1100000, added: '20240501' },
  'mixtral': { description: 'A set of Mixture of Experts (MoE) model with open weights by Mistral AI in 8x7b and 8x22b parameter sizes.', pulls: 205300 },
  'llama2': { description: 'Llama 2 is a collection of foundation language models ranging from 7B to 70B parameters.', pulls: 1400000 },
  'codegemma': { description: 'CodeGemma is a collection of powerful, lightweight models that can perform a variety of coding tasks like fill-in-the-middle code completion, code generation, natural language understanding, mathematical reasoning, and instruction following.', pulls: 35000, added: '20240501' },
  'command-r': { description: 'Command R is a Large Language Model optimized for conversational interaction and long context tasks.', pulls: 28500, added: '20240501' },
  'command-r-plus': { description: 'Command R+ is a powerful, scalable large language model purpose-built to excel at real-world enterprise use cases.', pulls: 23800, added: '20240501', contextWindow: 128000 },
  'llava': { description: '🌋 LLaVA is a novel end-to-end trained large multimodal model that combines a vision encoder and Vicuna for general-purpose visual and language understanding. Updated to version 1.6.', pulls: 166600 },
  'dbrx': { description: 'DBRX is an open, general-purpose LLM created by Databricks.', pulls: 4034, added: '20240501' },
  'codellama': { description: 'A large language model that can use text prompts to generate and discuss code.', pulls: 381200 },
  'qwen': { description: 'Qwen 1.5 is a series of large language models by Alibaba Cloud spanning from 0.5B to 110B parameters', pulls: 243800 },
  'dolphin-mixtral': { description: 'Uncensored, 8x7b and 8x22b fine-tuned models based on the Mixtral mixture of experts models that excels at coding tasks. Created by Eric Hartford.', pulls: 210300 },
  'llama2-uncensored': { description: 'Uncensored Llama 2 model by George Sung and Jarrad Hope.', pulls: 166900 },
  'mistral-openorca': { description: 'Mistral OpenOrca is a 7 billion parameter model, fine-tuned on top of the Mistral 7B model using the OpenOrca dataset.', pulls: 120100 },
  'deepseek-coder': { description: 'DeepSeek Coder is a capable coding model trained on two trillion code and natural language tokens.', pulls: 111700 },
  'phi': { description: 'Phi-2: a 2.7B language model by Microsoft Research that demonstrates outstanding reasoning and language understanding capabilities.', pulls: 89700 },
  'nomic-embed-text': { description: 'A high-performing open embedding model with a large token context window.', pulls: 83300, added: '20240501' },
  'dolphin-mistral': { description: 'The uncensored Dolphin model based on Mistral that excels at coding tasks. Updated to version 2.8.', pulls: 79700 },
  'orca-mini': { description: 'A general-purpose model ranging from 3 billion parameters to 70 billion, suitable for entry-level hardware.', pulls: 75900 },
  'nous-hermes2': { description: 'The powerful family of models by Nous Research that excels at scientific discussion and coding tasks.', pulls: 74000 },
  'zephyr': { description: 'Zephyr is a series of fine-tuned versions of the Mistral and Mixtral models that are trained to act as helpful assistants.', pulls: 53500 },
  'llama2-chinese': { description: 'Llama 2 based model fine tuned to improve Chinese dialogue ability.', pulls: 53400 },
  'wizard-vicuna-uncensored': { description: 'Wizard Vicuna Uncensored is a 7B, 13B, and 30B parameter model based on Llama 2 uncensored by Eric Hartford.', pulls: 49600 },
  'openhermes': { description: 'OpenHermes 2.5 is a 7B model fine-tuned by Teknium on Mistral with fully open datasets.', pulls: 43400 },
  'vicuna': { description: 'General use chat model based on Llama and Llama 2 with 2K to 16K context sizes.', pulls: 42100 },
  'tinyllama': { description: 'The TinyLlama project is an open endeavor to train a compact 1.1B Llama model on 3 trillion tokens.', pulls: 39500 },
  'starcoder2': { description: 'StarCoder2 is the next generation of transparently trained open code LLMs that comes in three sizes: 3B, 7B and 15B parameters.', pulls: 37600, added: '20240501' },
  'tinydolphin': { description: 'An experimental 1.1B parameter model trained on the new Dolphin 2.8 dataset by Eric Hartford and based on TinyLlama.', pulls: 37600 },
  'openchat': { description: 'A family of open-source models trained on a wide variety of data, surpassing ChatGPT on various benchmarks. Updated to version 3.5-0106.', pulls: 36300 },
  'starcoder': { description: 'StarCoder is a code generation model trained on 80+ programming languages.', pulls: 31400 },
  'stable-code': { description: 'Stable Code 3B is a coding model with instruct and code completion variants on par with models such as Code Llama 7B that are 2.5x larger.', pulls: 30900 },
  'wizardcoder': { description: 'State-of-the-art code generation model', pulls: 30800 },
  'neural-chat': { description: 'A fine-tuned model based on Mistral with good coverage of domain and language.', pulls: 25800 },
  'yi': { description: 'A high-performing, bilingual language model.', pulls: 25600 },
  'phind-codellama': { description: 'Code generation model based on Code Llama.', pulls: 23700 },
  'starling-lm': { description: 'Starling is a large language model trained by reinforcement learning from AI feedback focused on improving chatbot helpfulness.', pulls: 22000 },
  'wizard-math': { description: 'Model focused on math and logic problems', pulls: 21000 },
  'mxbai-embed-large': { description: 'State-of-the-art large embedding model from mixedbread.ai', pulls: 20800, added: '20240501' },
  'falcon': { description: 'A large language model built by the Technology Innovation Institute (TII) for use in summarization, text generation, and chat bots.', pulls: 20200 },
  'orca2': { description: 'Orca 2 is built by Microsoft research, and are a fine-tuned version of Meta\'s Llama 2 models.The model is designed to excel particularly in reasoning.', pulls: 19900 },
  'dolphin-phi': { description: '2.7B uncensored Dolphin model by Eric Hartford, based on the Phi language model by Microsoft Research.', pulls: 19700 },
  'dolphin-llama3': { description: 'Dolphin 2.9 is a new model with 8B and 70B sizes by Eric Hartford based on Llama 3 that has a variety of instruction, conversational, and coding skills.', pulls: 19700, added: '20240501' },
  'dolphincoder': { description: 'A 7B and 15B uncensored variant of the Dolphin model family that excels at coding, based on StarCoder2.', pulls: 17800, added: '20240501' },
  'nous-hermes': { description: 'General use models based on Llama and Llama 2 from Nous Research.', pulls: 16700 },
  'solar': { description: 'A compact, yet powerful 10.7B large language model designed for single-turn conversation.', pulls: 15200 },
  'sqlcoder': { description: 'SQLCoder is a code completion model fined-tuned on StarCoder for SQL generation tasks', pulls: 15200 },
  'bakllava': { description: 'BakLLaVA is a multimodal model consisting of the Mistral 7B base model augmented with the LLaVA architecture.', pulls: 14600 },
  'medllama2': { description: 'Fine-tuned Llama 2 model to answer medical questions based on an open source medical dataset.', pulls: 14200 },
  'nous-hermes2-mixtral': { description: 'The Nous Hermes 2 model from Nous Research, now trained over Mixtral.', pulls: 13700 },
  'wizardlm-uncensored': { description: 'Uncensored version of Wizard LM model', pulls: 13400 },
  'stablelm2': { description: 'Stable LM 2 is a state-of-the-art 1.6B parameter language model trained on multilingual data in English, Spanish, German, Italian, French, Portuguese, and Dutch.', pulls: 12700 },
  'codeup': { description: 'Great code generation model based on Llama2.', pulls: 12400 },
  'all-minilm': { description: 'Embedding models on very large sentence level datasets.', pulls: 11700, added: '20240501' },
  'everythinglm': { description: 'Uncensored Llama2 based model with support for a 16K context window.', pulls: 11700 },
  'samantha-mistral': { description: 'A companion assistant trained in philosophy, psychology, and personal relationships. Based on Mistral.', pulls: 11000 },
  'yarn-llama2': { description: 'An extension of Llama 2 that supports a context of up to 128k tokens.', pulls: 10600, contextWindow: 128000 },
  'deepseek-llm': { description: 'An advanced language model crafted with 2 trillion bilingual tokens.', pulls: 10500 },
  'stable-beluga': { description: 'Llama 2 based model fine tuned on an Orca-style dataset. Originally called Free Willy.', pulls: 10300 },
  'yarn-mistral': { description: 'An extension of Mistral to support context windows of 64K or 128K.', pulls: 10200 },
  'meditron': { description: 'Open-source medical large language model adapted from Llama 2 to the medical domain.', pulls: 9829 },
  'codeqwen': { description: 'CodeQwen1.5 is a large language model pretrained on a large amount of code data.', pulls: 9367, added: '20240501' },
  'llama-pro': { description: 'An expansion of Llama 2 that specializes in integrating both general language understanding and domain-specific knowledge, particularly in programming and mathematics.', pulls: 8978 },
  'magicoder': { description: '🎩 Magicoder is a family of 7B parameter models trained on 75K synthetic instruction data using OSS-Instruct, a novel approach to enlightening LLMs with open-source code snippets.', pulls: 8434 },
  'stablelm-zephyr': { description: 'A lightweight chat model allowing accurate, and responsive output without requiring high-end hardware.', pulls: 8387 },
  'codebooga': { description: 'A high-performing code instruct model created by merging two existing code models.', pulls: 7863 },
  'mistrallite': { description: 'MistralLite is a fine-tuned model based on Mistral with enhanced capabilities of processing long contexts.', pulls: 7351 },
  'wizard-vicuna': { description: 'Wizard Vicuna is a 13B parameter model based on Llama 2 trained by MelodysDreamj.', pulls: 7089 },
  'xwinlm': { description: 'Conversational model based on Llama 2 that performs competitively on various benchmarks.', pulls: 6971 },
  'nexusraven': { description: 'Nexus Raven is a 13B instruction tuned model for function calling tasks.', pulls: 6819 },
  'wizardlm': { description: 'General use model based on Llama 2.', pulls: 6358 },
  'goliath': { description: 'A language model created by combining two fine-tuned Llama 2 70B models into one.', pulls: 5501 },
  'open-orca-platypus2': { description: 'Merge of the Open Orca OpenChat model and the Garage-bAInd Platypus 2 model. Designed for chat and code generation.', pulls: 5252 },
  'notux': { description: 'A top-performing mixture of experts model, fine-tuned with high-quality data.', pulls: 4780 },
  'megadolphin': { description: 'MegaDolphin-2.2-120b is a transformation of Dolphin-2.2-70b created by interleaving the model with itself.', pulls: 4571 },
  'duckdb-nsql': { description: '7B parameter text-to-SQL model made by MotherDuck and Numbers Station.', pulls: 4432 },
  'alfred': { description: 'A robust conversational model designed to be used for both chat and instruct use cases.', pulls: 4042 },
  'notus': { description: 'A 7B chat model fine-tuned with high-quality data and based on Zephyr.', pulls: 3836 },
  'llama3-gradient': { description: 'This model extends LLama-3 8B\'s context length from 8k to over 1m tokens.', pulls: 3364, added: '20240501' },
  'snowflake-arctic-embed': { description: 'A suite of text embedding models by Snowflake, optimized for performance.', pulls: 3345, added: '20240501' },
  'moondream': { description: 'moondream is a small vision language model designed to run efficiently on edge devices.', pulls: 1553, added: '20240501' },
};
// export const OLLAMA_LAST_UPDATE: string = '20240501';
export const OLLAMA_PREV_UPDATE: string = '20240126';
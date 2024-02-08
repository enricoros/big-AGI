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
 */
export const OLLAMA_BASE_MODELS: { [key: string]: { description: string, pulls: number, added?: string } } = {
  'llama2': { description: 'The most popular model for general use.', pulls: 259800 },
  'mistral': { description: 'The 7B model released by Mistral AI, updated to version 0.2', pulls: 165500 },
  'llava': { description: '🌋 A novel end-to-end trained large multimodal model that combines a vision encoder and Vicuna for general-purpose visual and language understanding.', pulls: 17000, added: '20231215' },
  'mixtral': { description: 'A high-quality Mixture of Experts (MoE) model with open weights by Mistral AI.', pulls: 36700, added: '20231215' },
  'starling-lm': { description: 'Starling is a large language model trained by reinforcement learning from AI feedback focused on improving chatbot helpfulness.', pulls: 6569, added: '20231129' },
  'neural-chat': { description: 'A fine-tuned model based on Mistral with good coverage of domain and language.', pulls: 8164, added: '20231129' },
  'codellama': { description: 'A large language model that can use text prompts to generate and discuss code.', pulls: 111100 },
  'dolphin-mixtral': { description: 'An uncensored, fine-tuned model based on the Mixtral mixture of experts model that excels at coding tasks. Created by Eric Hartford.', pulls: 94800, added: '20231215' },
  'mistral-openorca': { description: 'Mistral OpenOrca is a 7 billion parameter model, fine-tuned on top of the Mistral 7B model using the OpenOrca dataset.', pulls: 87300 },
  'llama2-uncensored': { description: 'Uncensored Llama 2 model by George Sung and Jarrad Hope.', pulls: 54500 },
  'orca-mini': { description: 'A general-purpose model ranging from 3 billion parameters to 70 billion, suitable for entry-level hardware.', pulls: 40300 },
  'vicuna': { description: 'General use chat model based on Llama and Llama 2 with 2K to 16K context sizes.', pulls: 25200 },
  'wizard-vicuna-uncensored': { description: 'Wizard Vicuna Uncensored is a 7B, 13B, and 30B parameter model based on Llama 2 uncensored by Eric Hartford.', pulls: 21900 },
  'deepseek-coder': { description: 'DeepSeek Coder is a capable coding model trained on two trillion code and natural language tokens.', pulls: 21100, added: '20231129' },
  'phi': { description: 'Phi-2: a 2.7B language model by Microsoft Research that demonstrates outstanding reasoning and language understanding capabilities.', pulls: 18100, added: '20231220' },
  'dolphin-mistral': { description: 'The uncensored Dolphin model based on Mistral that excels at coding tasks. Updated to version 2.6.', pulls: 17800, added: '20240126' },
  'zephyr': { description: 'Zephyr beta is a fine-tuned 7B version of mistral that was trained on on a mix of publicly available, synthetic datasets.', pulls: 16400 },
  'wizardcoder': { description: 'State-of-the-art code generation model', pulls: 14300 },
  'phind-codellama': { description: 'Code generation model based on Code Llama.', pulls: 13500 },
  'openhermes': { description: 'OpenHermes 2.5 is a 7B model fine-tuned by Teknium on Mistral with fully open datasets.', pulls: 13000, added: '20240126' },
  'llama2-chinese': { description: 'Llama 2 based model fine tuned to improve Chinese dialogue ability.', pulls: 12700 },
  'orca2': { description: 'Orca 2 is built by Microsoft research, and are a fine-tuned version of Meta\'s Llama 2 models. The model is designed to excel particularly in reasoning.', pulls: 10500, added: '20231129' },
  'nous-hermes': { description: 'General use models based on Llama and Llama 2 from Nous Research.', pulls: 10100 },
  'wizard-math': { description: 'Model focused on math and logic problems', pulls: 10100 },
  'falcon': { description: 'A large language model built by the Technology Innovation Institute (TII) for use in summarization, text generation, and chat bots.', pulls: 9746 },
  'openchat': { description: 'A family of open-source models trained on a wide variety of data, surpassing ChatGPT on various benchmarks. Updated to version 3.5-0106.', pulls: 9089, added: '20231129' },
  'codeup': { description: 'Great code generation model based on Llama2.', pulls: 7566 },
  'tinyllama': { description: 'The TinyLlama project is an open endeavor to train a compact 1.1B Llama model on 3 trillion tokens.', pulls: 6784, added: '20240126' },
  'stable-beluga': { description: 'Llama 2 based model fine tuned on an Orca-style dataset. Originally called Free Willy.', pulls: 6702 },
  'everythinglm': { description: 'Uncensored Llama2 based model with support for a 16K context window.', pulls: 6580 },
  'medllama2': { description: 'Fine-tuned Llama 2 model to answer medical questions based on an open source medical dataset.', pulls: 6448 },
  'starcoder': { description: 'StarCoder is a code generation model trained on 80+ programming languages.', pulls: 6273 },
  'wizardlm-uncensored': { description: 'Uncensored version of Wizard LM model', pulls: 6241 },
  'yi': { description: 'A high-performing, bilingual language model.', pulls: 5648 },
  'dolphin-phi': { description: '2.7B uncensored Dolphin model by Eric Hartford, based on the Phi language model by Microsoft Research.', pulls: 5427, added: '20240126' },
  'bakllava': { description: 'BakLLaVA is a multimodal model consisting of the Mistral 7B base model augmented with the LLaVA architecture.', pulls: 5335, added: '20231215' },
  'solar': { description: 'A compact, yet powerful 10.7B large language model designed for single-turn conversation.', pulls: 4817 },
  'yarn-mistral': { description: 'An extension of Mistral to support context windows of 64K or 128K.', pulls: 4424 },
  'wizard-vicuna': { description: 'Wizard Vicuna is a 13B parameter model based on Llama 2 trained by MelodysDreamj.', pulls: 4129 },
  'samantha-mistral': { description: 'A companion assistant trained in philosophy, psychology, and personal relationships. Based on Mistral.', pulls: 3764 },
  'sqlcoder': { description: 'SQLCoder is a code completion model fined-tuned on StarCoder for SQL generation tasks', pulls: 3756 },
  'meditron': { description: 'Open-source medical large language model adapted from Llama 2 to the medical domain.', pulls: 3481, added: '20231129' },
  'stablelm-zephyr': { description: 'A lightweight chat model allowing accurate, and responsive output without requiring high-end hardware.', pulls: 3412, added: '20231210' },
  'open-orca-platypus2': { description: 'Merge of the Open Orca OpenChat model and the Garage-bAInd Platypus 2 model. Designed for chat and code generation.', pulls: 3403 },
  'yarn-llama2': { description: 'An extension of Llama 2 that supports a context of up to 128k tokens.', pulls: 3259 },
  'magicoder': { description: '🎩 Magicoder is a family of 7B parameter models trained on 75K synthetic instruction data using OSS-Instruct, a novel approach to enlightening LLMs with open-source code snippets.', pulls: 3118, added: '20231220' },
  'deepseek-llm': { description: 'An advanced language model crafted with 2 trillion bilingual tokens.', pulls: 3036, added: '20231129' },
  'nous-hermes2': { description: 'The powerful family of models by Nous Research that excels at scientific discussion and coding tasks.', pulls: 2604, added: '20240126' },
  'codebooga': { description: 'A high-performing code instruct model created by merging two existing code models.', pulls: 2495 },
  'mistrallite': { description: 'MistralLite is a fine-tuned model based on Mistral with enhanced capabilities of processing long contexts.', pulls: 2399 },
  'stable-code': { description: 'Stable Code 3B is a model offering accurate and responsive code completion at a level on par with models such as CodeLLaMA 7B that are 2.5x larger.', pulls: 2323, added: '20240126' },
  'nous-hermes2-mixtral': { description: 'The Nous Hermes 2 model from Nous Research, now trained over Mixtral.', pulls: 2173, added: '20240126' },
  'goliath': { description: 'A language model created by combining two fine-tuned Llama 2 70B models into one.', pulls: 2002, added: '20231129' },
  'nexusraven': { description: 'Nexus Raven is a 13B instruction tuned model for function calling tasks.', pulls: 1882 },
  'llama-pro': { description: 'An expansion of Llama 2 that specializes in integrating both general language understanding and domain-specific knowledge, particularly in programming and mathematics.', pulls: 1853, added: '20240126' },
  'wizardlm': { description: 'General use 70 billion parameter model based on Llama 2.', pulls: 1703 },
  'notux': { description: 'A top-performing mixture of experts model, fine-tuned with high-quality data.', pulls: 1564, added: '20240126' },
  'alfred': { description: 'A robust conversational model designed to be used for both chat and instruct use cases.', pulls: 1461, added: '20231129' },
  'xwinlm': { description: 'Conversational model based on Llama 2 that performs competitively on various benchmarks.', pulls: 1312 },
  'megadolphin': { description: 'MegaDolphin-2.2-120b is a transformation of Dolphin-2.2-70b created by interleaving the model with itself.', pulls: 1115, added: '20240126' },
  'qwen': { description: 'Qwen is a series of large language models by Alibaba Cloud spanning from 1.8B to 72B parameters', pulls: 1066, added: '20240126' },
  'notus': { description: 'A 7B chat model fine-tuned with high-quality data and based on Zephyr.', pulls: 885, added: '20240126' },
  'tinydolphin': { description: 'An experimental 1.1B parameter model trained on the new Dolphin 2.8 dataset by Eric Hartford and based on TinyLlama.', pulls: 735, added: '20240126' },
  'stablelm2': { description: 'Stable LM 2 1.6B is a state-of-the-art 1.6 billion parameter small language model trained on multilingual data in English, Spanish, German, Italian, French, Portuguese, and Dutch.', pulls: 45, added: '20240126' },
  'duckdb-nsql': { description: '7B parameter text-to-SQL model made by MotherDuck and Numbers Station.', pulls: 42, added: '20240126' },
};
// export const OLLAMA_LAST_UPDATE: string = '20240126';
export const OLLAMA_PREV_UPDATE: string = '20231220';
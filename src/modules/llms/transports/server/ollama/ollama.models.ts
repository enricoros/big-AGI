/**
 * This is here because the API does not provide a list of available upstream models, and does not provide
 * descriptions for the models.
 * (nor does it reliably provide context window sizes) - TODO: open a bug upstream
 *
 * from: https://ollama.ai/library?sort=popular
 */
export const OLLAMA_BASE_MODELS: { [key: string]: string } = {
  'mistral': 'The Mistral 7B model released by Mistral AI',
  'llama2': 'The most popular model for general use.',
  'codellama': 'A large language model that can use text prompts to generate and discuss code.',
  'vicuna': 'General use chat model based on Llama and Llama 2 with 2K to 16K context sizes.',
  'llama2-uncensored': 'Uncensored Llama 2 model by George Sung and Jarrad Hope.',
  'orca-mini': 'A general-purpose model ranging from 3 billion parameters to 70 billion, suitable for entry-level hardware.',
  'wizard-vicuna-uncensored': 'Wizard Vicuna Uncensored is a 7B, 13B, and 30B parameter model based on Llama 2 uncensored by Eric Hartford.',
  'nous-hermes': 'General use models based on Llama and Llama 2 from Nous Research.',
  'phind-codellama': 'Code generation model based on CodeLlama.',
  'mistral-openorca': 'Mistral OpenOrca is a 7 billion parameter model, fine-tuned on top of the Mistral 7B model using the OpenOrca dataset.',
  'wizardcoder': 'Llama based code generation model focused on Python.',
  'wizard-math': 'Model focused on math and logic problems',
  'llama2-chinese': 'Llama 2 based model fine tuned to improve Chinese dialogue ability.',
  'stable-beluga': 'Llama 2 based model fine tuned on an Orca-style dataset. Originally called Free Willy.',
  'zephyr': 'Zephyr beta is a fine-tuned 7B version of mistral that was trained on on a mix of publicly available, synthetic datasets.',
  'codeup': 'Great code generation model based on Llama2.',
  'falcon': 'A large language model built by the Technology Innovation Institute (TII) for use in summarization, text generation, and chat bots.',
  'everythinglm': 'Uncensored Llama2 based model with 16k context size.',
  'wizardlm-uncensored': 'Uncensored version of Wizard LM model',
  'medllama2': 'Fine-tuned Llama 2 model to answer medical questions based on an open source medical dataset.',
  'wizard-vicuna': 'Wizard Vicuna is a 13B parameter model based on Llama 2 trained by MelodysDreamj.',
  'open-orca-platypus2': 'Merge of the Open Orca OpenChat model and the Garage-bAInd Platypus 2 model. Designed for chat and code generation.',
  'starcoder': 'StarCoder is a code generation model trained on 80+ programming languages.',
  'samantha-mistral': 'A companion assistant trained in philosophy, psychology, and personal relationships. Based on Mistral.',
  'openhermes2-mistral': 'OpenHermes 2 Mistral is a 7B model fine-tuned on Mistral with 900,000 entries of primarily GPT-4 generated data from open datasets.',
  'wizardlm': 'General use 70 billion parameter model based on Llama 2.',
  'sqlcoder': 'SQLCoder is a code completion model fined-tuned on StarCoder for SQL generation tasks',
  'dolphin2.2-mistral': 'An instruct-tuned model based on Mistral. Version 2.2 is fine-tuned for improved conversation and empathy.',
  'dolphin2.1-mistral': 'An instruct-tuned model based on Mistral and trained on a dataset filtered to remove alignment and bias.',
  'yarn-mistral': 'An extension of Mistral to support a context of up to 128k tokens.',
  'codebooga': 'A high-performing code instruct model created by merging two existing code models.',
  'openhermes2.5-mistral': 'OpenHermes 2.5 Mistral 7B is a Mistral 7B fine-tune, a continuation of OpenHermes 2 model, which trained on additional code datasets.',
  'mistrallite': 'MistralLite is a fine-tuned model based on Mistral with enhanced capabilities of processing long contexts.',
  'nexusraven': 'Nexus Raven is a 13B instruction tuned model for function calling tasks.',
  'yarn-llama2': 'An extension of Llama 2 that supports a context of up to 128k tokens.',
  'xwinlm': 'Conversational model based on Llama 2 that performs competitively on various benchmarks.',
  'yi': 'A high-performing, bilingual base model.',
};
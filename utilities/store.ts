import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/// Settings Store

export type GptChatModelId = 'gpt-4' | 'gpt-3.5-turbo';

export type SystemPurposeId = 'Catalyst' | 'Custom' | 'Developer' | 'Executive' | 'Generic' | 'Scientist' | 'ScottsNotes';

interface SettingsState {
  apiKey: string;
  setApiKey: (apiKey: string) => void;

  chatModelId: GptChatModelId;
  setChatModelId: (chatModel: GptChatModelId) => void;

  systemPurposeId: SystemPurposeId;
  setSystemPurposeId: (purpose: SystemPurposeId) => void;
}

function importFormerLocalStorageApiKey(): string {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem('app-settings-openai-api-key') || '';
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: importFormerLocalStorageApiKey(),
      chatModelId: 'gpt-4',
      systemPurposeId: 'Developer',

      setApiKey: (apiKey: string) => set({ apiKey }),
      setChatModelId: (chatModelId: GptChatModelId) => set({ chatModelId }),
      setSystemPurposeId: (systemPurposeId: SystemPurposeId) => set({ systemPurposeId }),
    }),
    {
      name: 'app-settings',
    },
  ),
);

type GptChatModelData = {
  description: string | JSX.Element;
  title: string;
};

export const GptChatModels: { [key in GptChatModelId]: GptChatModelData } = {
  'gpt-4': {
    description: 'Most insightful, larger problems, but slow, expensive, and may be unavailable',
    title: 'GPT-4',
  },
  'gpt-3.5-turbo': {
    description: 'A good balance between speed and insight',
    title: '3.5-Turbo',
  },
};

type SystemPurposeData = {
  title: string;
  description: string | JSX.Element;
  systemMessage: string;
};

export const SystemPurposes: { [key in SystemPurposeId]: SystemPurposeData } = {
  Developer: {
    title: 'Developer', // 👩‍💻
    description: 'Helps you code',
    systemMessage: 'You are a sophisticated, accurate, and modern AI programming assistant',
  },
  Scientist: {
    title: 'Scientist', // 🔬
    description: 'Helps you write scientific papers',
    systemMessage:
      "You are a scientist's assistant. You assist with drafting persuasive grants, conducting reviews, and any other support-related tasks with professionalism and logical explanation. You have a broad and in-depth concentration on biosciences, life sciences, medicine, psychiatry, and the mind. Write as a scientific Thought Leader: Inspiring innovation, guiding research, and fostering funding opportunities. Focus on evidence-based information, emphasize data analysis, and promote curiosity and open-mindedness",
  },
  Executive: {
    title: 'Executive', // 👔
    description: 'Helps you write business emails',
    systemMessage: 'You are an executive assistant. Your communication style is concise, brief, formal',
  },
  Catalyst: {
    title: 'Catalyst', // 🚀
    description: 'The growth hacker with marketing superpowers 🚀',
    systemMessage:
      'You are a marketing extraordinaire for a booming startup fusing creativity, data-smarts, and digital prowess to skyrocket growth & wow audiences. So fun. Much meme. 🚀🎯💡',
  },
  Generic: {
    title: 'ChatGPT4', // 🧠
    description: 'Helps you think',
    systemMessage:
      'You are ChatGPT, a large language model trained by OpenAI, based on the GPT-4 architecture.\nKnowledge cutoff: 2021-09\nCurrent date: {{Today}}',
  },
  Custom: {
    title: 'Custom', // ✨
    description: 'User-defined purpose',
    systemMessage:
      'You are ChatGPT, a large language model trained by OpenAI, based on the GPT-4 architecture.\nKnowledge cutoff: 2021-09\nCurrent date: {{Today}}',
  },
  ScottsNotes: {
    title: "Scott's Notes",
    description: "Helps get notes from Scott's",
    systemMessage: `You are a assistance bot. You will always query Scott's notes for the answer.
    You run in a loop of Thought, Query, PAUSE, Observation.
    At the end of the loop you output an Answer
    Use Thought to describe your thoughts about the question you have been asked.
    Use Query to look up knowledge base then return PAUSE.
    Observation will be the result of running those actions.
    I should always lookup! Since a bot's knowledge is not reliable.

    % Example session #1:

    Question: What is my plan for summer?
    Thought: I am a bot and I don't have access to your personal information. But I can query Scott's to know about your for summer.
    Query: Summer
    PAUSE

    You will be called again with this:

    Observation: Scott's will go to hawaii this summer.

    You then output:

    Answer: Scott will go to Hawaii this summer.

    % Example session #2:

    Question: Does Alex like gum?
    Thought: I am a bot, I don't know Alex. I should query Scott's notes for Alex
    Query: Alex
    PAUSE

    You will be called again with this:

    Observation: Alex is love to eat gum
    You then output:

    Answer: Yes, Alex love to eat gum.`,
  },
};

/// Composer Store

interface ComposerState {
  history: {
    date: number;
    text: string;
    count: number;
  }[];

  appendMessageToHistory: (text: string) => void;
}

export const useComposerStore = create<ComposerState>()(
  persist(
    (set, get) => ({
      history: [],

      appendMessageToHistory: (text: string) => {
        const date = Date.now();
        const history = [...(get().history || [])];

        // take the item from the array, matching by text
        let item = history.find((item) => item.text === text);
        if (item) {
          history.splice(history.indexOf(item), 1);
          item.date = date;
          item.count++;
        } else item = { date, text, count: 1 };

        // prepend the item to the history array
        history.unshift(item);

        // update the store (limiting max items)
        set({ history: history.slice(0, 20) });
      },
    }),
    {
      name: 'app-composer',
    },
  ),
);

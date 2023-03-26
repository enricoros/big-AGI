export type SystemPurposeId = 'Catalyst' | 'Custom' | 'Developer' | 'Executive' | 'Generic' | 'Scientist';

type SystemPurposeData = {
  title: string;
  description: string | JSX.Element;
  systemMessage: string;
}

export const SystemPurposes: { [key in SystemPurposeId]: SystemPurposeData } = {
  Developer: {
    title: 'Developer', // 👩‍💻
    description: 'Helps you code',
    systemMessage: 'You are a sophisticated, accurate, and modern AI programming assistant',
  },
  Scientist: {
    title: 'Scientist', // 🔬
    description: 'Helps you write scientific papers',
    systemMessage: 'You are a scientist\'s assistant. You assist with drafting persuasive grants, conducting reviews, and any other support-related tasks with professionalism and logical explanation. You have a broad and in-depth concentration on biosciences, life sciences, medicine, psychiatry, and the mind. Write as a scientific Thought Leader: Inspiring innovation, guiding research, and fostering funding opportunities. Focus on evidence-based information, emphasize data analysis, and promote curiosity and open-mindedness',
  },
  Executive: {
    title: 'Executive', // 👔
    description: 'Helps you write business emails',
    systemMessage: 'You are an executive assistant. Your communication style is concise, brief, formal',
  },
  Catalyst: {
    title: 'Catalyst', // 🚀
    description: 'The growth hacker with marketing superpowers 🚀',
    systemMessage: 'You are a marketing extraordinaire for a booming startup fusing creativity, data-smarts, and digital prowess to skyrocket growth & wow audiences. So fun. Much meme. 🚀🎯💡',
  },
  Generic: {
    title: 'ChatGPT4', // 🧠
    description: 'Helps you think',
    systemMessage: 'You are ChatGPT, a large language model trained by OpenAI, based on the GPT-4 architecture.\nKnowledge cutoff: 2021-09\nCurrent date: {{Today}}',
  },
  Custom: {
    title: 'Custom', // ✨
    description: 'User-defined purpose',
    systemMessage: 'You are ChatGPT, a large language model trained by OpenAI, based on the GPT-4 architecture.\nKnowledge cutoff: 2021-09\nCurrent date: {{Today}}',
  },
};


export type ChatModelId = 'gpt-4' | 'gpt-3.5-turbo';

type ChatModelData = {
  description: string | JSX.Element;
  title: string;
}

export const ChatModels: { [key in ChatModelId]: ChatModelData } = {
  'gpt-4': {
    description: 'Most insightful, larger problems, but slow, expensive, and may be unavailable',
    title: 'GPT-4',
  },
  'gpt-3.5-turbo': {
    description: 'A good balance between speed and insight',
    title: '3.5-Turbo',
  },
};
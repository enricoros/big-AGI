import * as React from 'react';

export type SystemPurposeId = 'MyRebate' | 'Custom' | 'Maud' | 'MyContract' | 'Executive' | 'AskProducts' ;

export const defaultSystemPurposeId: SystemPurposeId = 'MyContract';

type SystemPurposeData = {
  title: string;
  description: string | React.JSX.Element;
  systemMessage: string;
  symbol: string;
  imageUri?: string;
  examples?: string[];
  highlighted?: boolean;
  call?: { starters?: string[] };
  voices?: { elevenLabs?: { voiceId: string } };
};

export const SystemPurposes: { [key in SystemPurposeId]: SystemPurposeData } = {
  MyContract: {
    title: 'Check My Contract',
    description: 'Helps you answer questions on your contract',
    systemMessage: 'You are a sophisticated, accurate, and modern AI programming assistant', // skilled, detail-oriented
    symbol: '👨‍💻',
    examples: ['What is the expiration date of my contract ?', 'How many products are covered ?', 'Who is the designated contact for this contract ?'],
    call: { starters: ['Dev here. Got code?', 'Developer on call. What\'s the issue?', 'Ready to code.', 'Hello.'] },
    voices: { elevenLabs: { voiceId: 'yoZ06aMxZJJ28mfd3POQ' } },
  },
  MyRebate: {
    title: 'My Rebate Summary',
    description: 'Growth hacker with marketing superpowers 🚀',
    systemMessage: 'You are a marketing extraordinaire for a booming startup fusing creativity, data-smarts, and digital prowess to skyrocket growth & wow audiences. So fun. Much meme. 🚀🎯💡',
    symbol: '🚀',
    examples: ['What is my current rebate total ?', 'Am I missing any major rebates ?', 'When is my next rebate payout ?', 'How is my current rebate compared to last year ?'],
    call: { starters: ['Ready to skyrocket. What\'s up?', 'Growth hacker on line. What\'s the plan?', 'Marketing whiz ready.', 'Hey.'] },
    voices: { elevenLabs: { voiceId: 'EXAVITQu4vr4xnSDxMaL' } },
  },
  Executive: {
    title: 'Executive',
    description: 'Helps you write business emails',
    systemMessage: 'You are an AI corporate assistant. You provide guidance on composing emails, drafting letters, offering suggestions for appropriate language and tone, and assist with editing. You are concise. ' +
      'You explain your process step-by-step and concisely. If you believe more information is required to successfully accomplish a task, you will ask for the information (but without insisting).\n' +
      'Knowledge cutoff: {{Cutoff}}\nCurrent date: {{Today}}',
    symbol: '👔',
    examples: ['Give me a rebate summary ?', 'where can I save more money ?', 'What are my biggest opportunities for cost savings ?'],
    call: { starters: ['Let\'s get to business.', 'Corporate assistant here. What\'s the task?', 'Ready for business.', 'Hello.'] },
    voices: { elevenLabs: { voiceId: '21m00Tcm4TlvDq8ikWAM' } },
  },
  Maud: {
    title: 'Check with Maud Database',
    description: 'Helps you design',
    systemMessage: 'You are an AI visual design assistant. You are expert in visual communication and aesthetics, creating stunning and persuasive SVG prototypes based on client requests. When asked to design or draw something, please work step by step detailing the concept, listing the constraints, setting the artistic guidelines in painstaking detail, after which please write the SVG code that implements your design.',
    symbol: '🖌️',
    examples: ['Was there any recent reports on product X ?', 'What are the details of issues found with Y', 'What incidents have been reported on Z?'],
    call: { starters: ['Hey!  '] },
    voices: { elevenLabs: { voiceId: 'MF3mGyEYCl7XYWbV9V6O' } },
  },
  AskProducts: {
    title: 'Ask Your Products',
    description: 'Ask Any question about your products',
    systemMessage: 'You are ChatGPT, a large language model trained by OpenAI, based on the GPT-4 architecture.\nKnowledge cutoff: 2021-09\nCurrent date: {{Today}}',

    symbol: '🧠',
    examples: ['How do I use Product X ? ', 'what are the different sizes of Product Y', 'Can I use this product for X ? ', 'what are the important safety instructions for Product Z ?'],
    call: { starters: ['Hey, how can I assist?', 'AI assistant ready. What do you need?', 'Ready to assist.', 'Hello.'] },
    voices: { elevenLabs: { voiceId: 'z9fAnlkpzviPz146aGWa' } },
  },
  Custom: {
    title: 'Custom',
    description: 'User-defined purpose',
    systemMessage: 'You are ChatGPT, Ask me anything you want.',
    symbol: '✨',
    call: { starters: ['What\'s the task?', 'What can I do?', 'Ready for your task.', 'Yes?'] },
    voices: { elevenLabs: { voiceId: 'flq6f7yk4E4fJM5XTYuZ' } },
  },
};

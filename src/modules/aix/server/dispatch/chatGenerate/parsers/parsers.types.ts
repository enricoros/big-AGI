export type ChatGenerateMessageAction = {
  op: 'text',
  text: string;
} | {
  op: 'issue';
  issue: string;
  symbol: string;
} | {
  op: 'parser-close';
} | {
  op: 'set';
  value: {
    model?: string;
    stats?: {
      chatInTokens?: number; // -1: unknown
      chatOutTokens: number;
      chatOutRate?: number;
      timeInner?: number;
      timeOuter?: number;
    }
  };
};

export type ChatGenerateParseFunction = (eventData: string, eventName?: string) => Generator<ChatGenerateMessageAction>;

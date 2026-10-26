// messageTerminalOutcome: every stored stop reason, the fragment scan, and stop reasons this build does not know
// (no expected value for those: their classification is a policy, the check is that minified equals source)
const text = { ft: 'content', part: { pt: 'text', text: 'x' } };
const error = { ft: 'content', part: { pt: 'error', error: 'e' } };
const tool = { ft: 'content', part: { pt: 'tool_invocation' } };
const notice = { ft: 'void', part: { pt: 'ph', pType: 'notice' } };
const generator = (tokenStopReason) => (tokenStopReason === undefined ? {} : { tokenStopReason });

const spec = {
  source: 'src/common/stores/chat/chat.message.outcome.ts',
  export: 'messageTerminalOutcome',
  stubs: {
    'chat.fragments': { isContentFragment: (f) => f.ft === 'content', isErrorPart: (p) => p.pt === 'error' },
  },
  cases: [
    [[{ generator: generator(), fragments: [text] }], 'completed'],
    [[{ generator: generator(), fragments: [text, error] }], 'failed'],
    [[{ generator: generator(), fragments: [error, text] }], 'completed'],
    [[{ generator: generator(), fragments: [text, notice] }], 'completed'],
    [[{ generator: generator(), fragments: [tool] }], 'completed'],
    [[{ generator: generator(), fragments: [] }], 'completed'],
    [[{ generator: undefined, fragments: [text] }], 'completed'],
    [[{ fragments: [text, error] }], 'failed'],
    [[{ generator: generator('out-of-tokens'), fragments: [text] }], 'truncated'],
    [[{ generator: generator('issue'), fragments: [text] }], 'failed'],
    [[{ generator: generator('filter'), fragments: [] }], 'failed'],
    [[{ generator: generator('client-abort'), fragments: [text] }], 'aborted'],
    [[{ generator: generator('a-future-reason'), fragments: [text] }]],
    [[{ generator: generator('toString'), fragments: [text] }]],
    [[{ generator: generator(null), fragments: [text] }]],
  ],
};

export default spec;

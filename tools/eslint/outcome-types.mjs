// Outcome guard: outcomes are derived (messageTerminalOutcome) and stop reasons checked (gcStopReasonRow), never cast.
// A cast hides an out-of-union value, which comes from a miscompile or a bug.

const OUTCOME_TYPE_NAMES = new Set(['DMessageTerminalOutcome', 'DMessageOutcome', 'BeamStatus', 'AixChatGenerateTerminal_LL', 'GCTokenStopReason']);

// an outcome type, plain or qualified (AixWire_Particles.GCTokenStopReason), or a stop reason (DMessageGenerator['tokenStopReason'])
const isOutcomeType = (n) =>
  (n.type === 'TSTypeReference' && OUTCOME_TYPE_NAMES.has(n.typeName.name ?? n.typeName.right?.name))
  || (n.type === 'TSIndexedAccessType' && n.indexType.literal?.value === 'tokenStopReason');

// the type or anything inside it: union members, array elements, type arguments (NonNullable<...>)
function mentionsOutcomeType(n, visitorKeys) {
  return isOutcomeType(n)
    || (visitorKeys[n.type] ?? []).some((key) => [n[key]].flat().some((child) => child?.type && mentionsOutcomeType(child, visitorKeys)));
}

const noCast = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow casts to outcome types' },
    schema: [],
    messages: {
      cast: 'Do not cast to an outcome type: derive an outcome (messageTerminalOutcome), check a stop reason (gcStopReasonRow) - a cast hides an out-of-union value, which comes from a miscompile or a bug.',
    },
  },
  create(context) {
    // only the cast's type: a typed parameter inside the cast expression is not a cast
    const check = (node) => {
      if (mentionsOutcomeType(node.typeAnnotation, context.sourceCode.visitorKeys))
        context.report({ node: node.typeAnnotation, messageId: 'cast' });
    };
    return { TSAsExpression: check, TSTypeAssertion: check };
  },
};

const plugin = { rules: { 'no-cast': noCast } };
plugin.configs = {
  recommended: {
    plugins: { outcome: plugin },
    rules: { 'outcome/no-cast': 'error' },
  },
};

export default plugin;

// SWC miscompile guard: shapes the Next 15.5 minifier can mis-transform (swc#11970, #12492, #12298, #12300).
// Drop it once Next ships the fixes: #11970 is fixed from 16.3, #12492 in no stable release yet.

const isExit = (stmt) => stmt?.type === 'ReturnStatement' || stmt?.type === 'ThrowStatement';
const isPlainBreak = (stmt) => stmt?.type === 'BreakStatement' && !stmt.label;
const isLexicalDecl = (stmt) => stmt.type === 'VariableDeclaration' && (stmt.kind === 'const' || stmt.kind === 'let');
const last = (list) => list[list.length - 1];

// the clause's statements, unwrapped from a single braced block: `case x: { ... }`
const clauseBody = (clause) => clause.consequent.length === 1 && clause.consequent[0].type === 'BlockStatement' ? clause.consequent[0].body : clause.consequent;

// a clause leaves the switch: it returns, throws, breaks with nothing else, or is empty (falls into the next one)
function clauseExits(clause) {
  const tail = last(clause.consequent);
  if (!tail) return true;
  if (tail.type !== 'BlockStatement')
    return isExit(tail) || (tail.type === 'BreakStatement' && clause.consequent.length === 1);
  const inner = last(tail.body);
  return !inner || isExit(inner) || (inner.type === 'BreakStatement' && tail.body.length === 1);
}

// statements follow the node; outside a statement list (an unbraced `if` body) it counts as followed, conservatively
const followedByCode = (node) => !Object.values(node.parent).some((v) => Array.isArray(v) && last(v) === node);

// swc#11970: a returning default merges with an identical clause, a break-only or empty clause ends up last, and the
// statements after the switch are dropped as unreachable
function dropsTail(node) {
  const { cases } = node;
  const defaultClause = cases.find((c) => c.test === null);
  if (!defaultClause || !isExit(last(clauseBody(defaultClause))) || !followedByCode(node) || !cases.every(clauseExits))
    return false;
  const breakOnly = (c) => c.consequent.length === 1 && clauseBody(c).length === 1 && isPlainBreak(clauseBody(c)[0]);
  return cases.some(breakOnly) || clauseBody(last(cases)).length === 0;
}

// swc#12298: a switch over a constant (not the `switch (true)` idiom) loses its fallthrough clauses
const isConstantDiscriminant = (d) =>
  (d.type === 'Literal' && d.raw !== 'true' && d.raw !== 'false') || (d.type === 'TemplateLiteral' && d.expressions.length === 0);

// swc#12492: statements made only of const/let declarations (and a plain break), one of them holding a closure
function onlyClosureDecls(statements, sourceCode) {
  const holdsFunction = (n) => n.type === 'ArrowFunctionExpression' || n.type === 'FunctionExpression'
    || (sourceCode.visitorKeys[n.type] ?? []).some((key) => [n[key]].flat().some((child) => child?.type && holdsFunction(child)));
  return statements.every((s) => isLexicalDecl(s) || isPlainBreak(s))
    && statements.some((s) => isLexicalDecl(s) && holdsFunction(s));
}

const miscompile = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow the shapes the SWC minifier in Next 15.5 can mis-transform' },
    schema: [],
    messages: {
      switchTail: 'The SWC minifier (Next 15.5, swc#11970) can drop the code after this switch: a break-only or empty-last case, a returning default and every other case exiting. Guard the switch with an if, or use a lookup table.',
      caseClosure: 'The SWC minifier (Next 15.5, swc#12492) can drop a case made only of const/let declarations holding a closure. Declare the closure outside the switch.',
      constantSwitch: 'The SWC minifier (Next 15.5, swc#12298) can drop the fallthrough clauses of a switch over a constant. Use if/else.',
    },
  },
  create(context) {
    const { sourceCode } = context;
    return {
      SwitchStatement(node) {
        if (dropsTail(node)) context.report({ node, messageId: 'switchTail' });
        if (isConstantDiscriminant(node.discriminant)) context.report({ node, messageId: 'constantSwitch' });
      },
      SwitchCase(node) {
        const [first] = node.consequent;
        // declarations directly in the case...
        if (first?.type === 'VariableDeclaration' && onlyClosureDecls(node.consequent, sourceCode))
          context.report({ node, messageId: 'caseClosure' });
        // ...or in its braced block
        if (first?.type === 'BlockStatement' && node.consequent.length <= 2 && node.consequent.every((s) => s.type === 'BlockStatement' || isPlainBreak(s)))
          for (const block of node.consequent)
            if (block.type === 'BlockStatement' && onlyClosureDecls(block.body, sourceCode))
              context.report({ node: block, messageId: 'caseClosure' });
      },
    };
  },
};

const plugin = { rules: { miscompile } };
plugin.configs = {
  recommended: {
    plugins: { swc: plugin },
    rules: {
      'swc/miscompile': 'error',
      'no-unsafe-finally': 'error', // swc#12300: control flow leaving a finally block can be mis-transformed
    },
  },
};

export default plugin;

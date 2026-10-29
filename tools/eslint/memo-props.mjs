// Memo guard: a value created on every render, passed to a React.memo component, makes the memo compare and
// re-render anyway. Only the memo boundary matters (the same literal on a plain Box costs the same hoisted or
// inline, measured), so memoized components are found by type - React.memo returns MemoExoticComponent /
// NamedExoticComponent - with no naming convention. Children are checked for our own components only: a library
// container that is memoized and takes children (dnd-kit's DndContext) can't hold for anyone.
// Prior art: eslint-plugin-react-perf and eslint-plugin-react-usememo flag the same shapes on every component.

import ts from 'typescript';

const LITERALS = new Set(['ObjectExpression', 'ArrayExpression', 'ArrowFunctionExpression', 'FunctionExpression', 'JSXElement', 'JSXFragment', 'NewExpression']);
const PRODUCERS = /^(map|filter|slice|concat|flat|flatMap|sort|toSorted|keys|values|entries|from)$/; // .map(...), Object.keys(...), Array.from(...)
const MEMO_TYPES = /^(Memo|Named)ExoticComponent$/;

// a new identity on every evaluation: a literal, also behind `as const`/`satisfies`/`!`, a producer call, or a branch holding one
const isFresh = (e) => !!e && (LITERALS.has(e.type)
  || (e.type.startsWith('TS') && isFresh(e.expression))
  || [e.consequent, e.alternate, e.left, e.right].some(isFresh)
  || (e.type === 'CallExpression' && e.callee.type === 'MemberExpression' && PRODUCERS.test(e.callee.property.name ?? '')));

// at module scope, or inside a useMemo callback: created once, not per render
function isCreatedOnce(node) {
  let fn = node;
  while (fn && !/Function/.test(fn.type)) fn = fn.parent;
  const call = fn?.parent;
  return !fn || (call?.type === 'CallExpression' && call.arguments[0] === fn && /useMemo$/.test(call.callee.property?.name ?? call.callee.name ?? ''));
}

const isMemoType = (type) => MEMO_TYPES.test(type.aliasSymbol?.name ?? type.symbol?.name ?? '') || (type.types ?? []).some(isMemoType);

const freshProps = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Disallow values created on every render as props or children of a React.memo component' },
    schema: [],
    messages: {
      literal: '`{{prop}}` of memoized <{{component}}> is created on every render, so the memo never holds. Hoist it if static, useMemo/useCallback it if derived, or drop the memo.',
      children: 'Children of memoized <{{component}}> are created on every render, so the memo never holds. Memoize the element, or drop the memo.',
    },
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    if (!services?.program) return {}; // no type information for this file
    const checker = services.program.getTypeChecker();
    const isExternal = (tsNode) => { // declared under node_modules, through an import alias if any
      let symbol = checker.getSymbolAtLocation(tsNode);
      if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
      return /[\\/]node_modules[\\/]/.test(symbol?.declarations?.[0]?.getSourceFile().fileName ?? '');
    };
    return {
      JSXOpeningElement(node) {
        if (node.name.type === 'JSXIdentifier' && /^[a-z]/.test(node.name.name)) return; // host element
        const attrs = node.attributes.filter((a) => a.type === 'JSXAttribute' && isFresh(a.value?.expression));
        const children = node.parent.children.filter((c) => LITERALS.has(c.type) || isFresh(c.expression));
        if (!attrs.length && !children.length) return; // the type checker is asked only for candidates
        if (isCreatedOnce(node)) return;
        const tsNode = services.esTreeNodeToTSNodeMap.get(node.name);
        if (!isMemoType(checker.getTypeAtLocation(tsNode))) return;
        const component = context.sourceCode.getText(node.name);
        for (const attr of attrs)
          context.report({ node: attr.value, messageId: 'literal', data: { component, prop: attr.name.name } });
        if (children.length && !isExternal(tsNode))
          context.report({ node: children[0], messageId: 'children', data: { component } });
      },
    };
  },
};

const plugin = { rules: { 'fresh-props': freshProps } };
plugin.configs = { recommended: { files: ['src/**/*.tsx'], plugins: { memo: plugin }, rules: { 'memo/fresh-props': 'warn' } } };
export default plugin;

// Sx guard: Emotion turns every distinct sx value into a CSS rule and never removes it, so geometry computed at
// render (a drag transform per frame, a width per search keystroke) grows the stylesheet for the session. Such
// values belong in style={...}. Found by type: a value that can carry a wide `number` (or, for transform and
// transition, a wide `string`) into the CSS; literals, unions of literals and local consts of those pass
// (`const h = c ? 8 : 4` is two values, though typed number). Spacing-like keys take theme units, not CSS.

import ts from 'typescript';

const THEME_KEYS = /^(m|p)[trblxy]?$|^(margin|padding)|^(gap|rowGap|columnGap|zIndex|flex|flexGrow|flexShrink|order|opacity|fontWeight|lineHeight)$/;
const STRING_KEYS = /^(transform|transition)$/; // dnd-kit and animation drivers: a new string per frame

const isWide = (type, flags) => type.isUnion() ? type.types.some((t) => isWide(t, flags)) : !!(type.flags & flags);

const computedValues = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Disallow sx values computed at render: each distinct value adds a CSS rule for the session' },
    schema: [],
    messages: {
      computed: '`{{key}}` in sx is computed at render: every distinct value adds a CSS rule that is never removed. Move it to style={...}.',
    },
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    if (!services?.program) return {}; // no type information for this file
    const checker = services.program.getTypeChecker();
    const tsOf = (e) => services.esTreeNodeToTSNodeMap.get(e);

    // can this expression carry a wide-typed value into the CSS value
    const carries = (e, flags, depth = 0) => {
      if (!e || depth > 4) return false;
      const next = (x) => carries(x, flags, depth);
      switch (e.type) {
        case 'Literal':
          return false;
        case 'TemplateLiteral':
          return e.expressions.some(next);
        case 'ConditionalExpression':
          return next(e.consequent) || next(e.alternate);
        case 'LogicalExpression':
          return next(e.right) || (e.operator !== '&&' && next(e.left));
        case 'BinaryExpression':
          return ['+', '-', '*', '/', '%'].includes(e.operator) && (next(e.left) || next(e.right));
        case 'UnaryExpression':
          return next(e.argument);
        case 'CallExpression': // Math.round(d * 0.6) is as bounded as d
          if (e.callee.type === 'MemberExpression' && e.callee.object.name === 'Math') return e.arguments.some(next);
          break;
        case 'Identifier': { // a local const: judge its initializer
          const tsNode = tsOf(e);
          const symbol = ts.isShorthandPropertyAssignment(tsNode.parent) ? checker.getShorthandAssignmentValueSymbol(tsNode.parent) : checker.getSymbolAtLocation(tsNode);
          const decl = symbol?.valueDeclaration;
          const init = decl && ts.isVariableDeclaration(decl) && decl.initializer && (decl.parent.flags & ts.NodeFlags.Const) && services.tsNodeToESTreeNodeMap.get(decl.initializer);
          if (init) return carries(init, flags, depth + 1);
        }
      }
      if (e.type.startsWith('TS')) return next(e.expression); // `as const`, `satisfies`, `!`
      return isWide(checker.getTypeAtLocation(tsOf(e)), flags);
    };

    const walk = (obj) => {
      for (const p of obj.properties) {
        if (p.type === 'SpreadElement') { spread(p.argument); continue; }
        if (p.type !== 'Property') continue;
        if (p.value.type === 'ObjectExpression') { walk(p.value); continue; } // nested selectors, breakpoints
        const key = p.key.type === 'Identifier' ? p.key.name : String(p.key.value);
        if (THEME_KEYS.test(key)) continue;
        if (carries(p.value, STRING_KEYS.test(key) ? ts.TypeFlags.Number | ts.TypeFlags.String : ts.TypeFlags.Number))
          context.report({ node: p.value, messageId: 'computed', data: { key } });
      }
    };
    // ...{ }, ...(cond && { }), ...(cond ? { } : { })
    const spread = (e) => {
      if (e.type === 'ObjectExpression') walk(e);
      else if (e.type === 'LogicalExpression') spread(e.right);
      else if (e.type === 'ConditionalExpression') [e.consequent, e.alternate].forEach(spread);
    };

    return {
      JSXAttribute(node) {
        if (node.name.name === 'sx' && node.value?.type === 'JSXExpressionContainer' && node.value.expression.type === 'ObjectExpression')
          walk(node.value.expression);
      },
    };
  },
};

const plugin = { rules: { 'computed-values': computedValues } };
plugin.configs = { recommended: { files: ['src/**/*.tsx'], plugins: { sx: plugin }, rules: { 'sx/computed-values': 'warn' } } };
export default plugin;

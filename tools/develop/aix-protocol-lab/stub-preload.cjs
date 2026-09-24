// Node preload for lab commands that load the CLIENT half of AIX (ContentReassembler, the DMessage -> request
// converter): that graph reaches next/font, CSS and asset imports, and browser-only packages. Each such module
// resolves to a callable/constructible Proxy that answers every property with itself.
//   node --require tools/develop/aix-protocol-lab/stub-preload.cjs --import tsx tools/develop/aix-protocol-lab/lab.ts chain ...
// STUB_MODULES (comma-separated substrings) force-stubs additional modules by specifier or resolved path.
const { registerHooks } = require('node:module');

const FORCE = [/^next\/font\//, /\.(css|scss|svg|png|jpg|jpeg|gif|webp|woff2?|ttf|mp3|wav|ogg)$/i];
const STUBS = (process.env.STUB_MODULES || '').split(',').map(s => s.trim()).filter(Boolean);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (FORCE.some(re => re.test(specifier)) || STUBS.some(s => specifier.includes(s)))
      return { url: `stubmissing:${specifier}`, format: 'commonjs', shortCircuit: true };
    try {
      const resolved = nextResolve(specifier, context);
      if (STUBS.some(s => resolved.url.includes(s)))
        return { url: `stubmissing:${specifier}`, format: 'commonjs', shortCircuit: true };
      return resolved;
    } catch (error) {
      // a bare package missing from node_modules (dev-only deps of the app graph) becomes a stub; relative paths still throw
      if ((error.code === 'MODULE_NOT_FOUND' || error.code === 'ERR_MODULE_NOT_FOUND') && !specifier.startsWith('.') && !specifier.startsWith('/'))
        return { url: `stubmissing:${specifier}`, format: 'commonjs', shortCircuit: true };
      throw error;
    }
  },
  load(url, context, nextLoad) {
    if (url.startsWith('stubmissing:')) {
      const source = `
        const handler = { get: (t, k) => k === '__esModule' ? false : k === 'then' ? undefined : k === Symbol.toPrimitive ? () => '' : proxy, apply: () => proxy, construct: () => proxy };
        const proxy = new Proxy(function () {}, handler);
        module.exports = proxy;`;
      return { format: 'commonjs', source, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

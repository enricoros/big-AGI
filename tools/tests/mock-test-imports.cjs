const Module = require('node:module');
const path = require('node:path');

const originalResolveFilename = Module._resolveFilename;
const stubByRequest = new Map([
  ['next/font/google', path.join(__dirname, 'stubs', 'next-font-google.cjs')],
  ['@googleworkspace/drive-picker-react', path.join(__dirname, 'stubs', 'drive-picker-react.cjs')],
  ['~/modules/t2i/t2i.client', path.join(__dirname, 'stubs', 't2i-client.cjs')],
  [path.join(process.cwd(), 'src', 'modules', 't2i', 't2i.client.ts'), path.join(__dirname, 'stubs', 't2i-client.cjs')],
]);

Module._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  const stubPath = stubByRequest.get(request);
  if (stubPath)
    return stubPath;
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions['.css'] = () => {};

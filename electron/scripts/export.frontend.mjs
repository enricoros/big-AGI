import { default as fs, renameSync } from 'fs';
import { dirname as pathDirName, join as pathJoin } from 'path';
import { fileURLToPath } from 'url';


// build-time configuration
const buildOnlyFrontend = process.argv.includes('--hide') ? true
  : process.argv.includes('--restore') ? false
    : !!process.env.EXPORT_FRONTEND;


function getApiDirName() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = pathDirName(__filename);
  return pathJoin(__dirname, '../../app/api');
}

function findAllFiles(startDir) {
  return fs.readdirSync(startDir).flatMap((file) => {
      const fullPath = pathJoin(startDir, file);
      if (fs.statSync(fullPath).isDirectory())
        return findAllFiles(fullPath);
      return fullPath;
    },
  );
}

/**
 * Hide/show API routes depending on the build type
 * Due to an upstream bug, NextJS will not ignore the nodejs API routes and choose to abort instead.
 */
function frontendHotFixAPIVisibility(hideFiles) {
  const apiDirName = getApiDirName();
  const apiRoutesPaths = findAllFiles(apiDirName)
    .filter((path) => path.endsWith('.ts') || path.endsWith('.ts.backup'));

  apiRoutesPaths.forEach((path) => {
    const isBackup = path.endsWith('.backup');
    if (hideFiles) {
      // If building the frontend, rename (effectively hide) the file
      !isBackup && renameSync(path, `${path}.backup`);
    } else {
      // If it's a normal build and including API routes and a backup exists, restore it
      isBackup && renameSync(path, path.slice(0, -7));
    }
  });
}

frontendHotFixAPIVisibility(buildOnlyFrontend);

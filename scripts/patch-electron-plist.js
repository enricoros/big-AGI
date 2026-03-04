/**
 * Patches the Electron.app Info.plist so macOS shows "big-AGI" in the dock
 * instead of "Electron". Also replaces the default electron.icns with the
 * big-AGI icon. Run automatically via postinstall.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

if (process.platform !== 'darwin') {
  process.exit(0);
}

const electronApp = path.join(
  __dirname, '..', 'node_modules', 'electron', 'dist', 'Electron.app',
);
const plistPath = path.join(electronApp, 'Contents', 'Info.plist');

if (!fs.existsSync(plistPath)) {
  console.log('[patch] Electron.app not found, skipping plist patch');
  process.exit(0);
}

const APP_NAME = 'big-AGI';

// Patch CFBundleName and CFBundleDisplayName
try {
  execSync(`/usr/libexec/PlistBuddy -c "Set :CFBundleName ${APP_NAME}" "${plistPath}"`);
} catch { /* already set */ }

try {
  execSync(`/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName ${APP_NAME}" "${plistPath}"`);
} catch {
  execSync(`/usr/libexec/PlistBuddy -c "Add :CFBundleDisplayName string ${APP_NAME}" "${plistPath}"`);
}

// Copy big-AGI icon as the app icon (replaces electron.icns)
// We generate a simple .icns from the PNG using sips (built into macOS)
const srcIcon = path.join(__dirname, '..', 'public', 'icons', 'icon-1024x1024.png');
const destIcon = path.join(electronApp, 'Contents', 'Resources', 'electron.icns');

if (fs.existsSync(srcIcon)) {
  const tmpIconset = path.join(__dirname, '..', 'node_modules', '.cache', 'big-agi.iconset');
  fs.mkdirSync(tmpIconset, { recursive: true });

  const sizes = [16, 32, 64, 128, 256, 512, 1024];
  for (const size of sizes) {
    const outFile = size === 1024
      ? path.join(tmpIconset, 'icon_512x512@2x.png')
      : path.join(tmpIconset, `icon_${size}x${size}.png`);
    execSync(`sips -z ${size} ${size} "${srcIcon}" --out "${outFile}" 2>/dev/null`);
    // Also create @2x variants
    if (size <= 512 && size * 2 <= 1024) {
      const retinaFile = path.join(tmpIconset, `icon_${size}x${size}@2x.png`);
      execSync(`sips -z ${size * 2} ${size * 2} "${srcIcon}" --out "${retinaFile}" 2>/dev/null`);
    }
  }

  try {
    execSync(`iconutil -c icns "${tmpIconset}" -o "${destIcon}" 2>/dev/null`);
    console.log(`[patch] Replaced electron.icns with big-AGI icon`);
  } catch (e) {
    console.log(`[patch] Could not generate .icns: ${e.message}`);
  }

  // Cleanup
  fs.rmSync(tmpIconset, { recursive: true, force: true });
}

console.log(`[patch] Patched Electron.app → "${APP_NAME}"`);

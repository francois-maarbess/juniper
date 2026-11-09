const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo watch folders
config.watchFolders = [workspaceRoot];

// Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Sanitize Windows double drive letter bug (e.g. "c:\C:\...")
const standardResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  let cleanName = moduleName;
  if (typeof cleanName === 'string') {
    cleanName = cleanName.replace(/^[/\\]([a-zA-Z]:)/, '$1');
    if (/^[a-zA-Z]:[/\\][a-zA-Z]:/.test(cleanName)) {
      cleanName = cleanName.replace(/^[a-zA-Z]:[/\\]/, '');
    }
  }
  if (standardResolveRequest) {
    return standardResolveRequest(context, cleanName, platform);
  }
  return context.resolveRequest(context, cleanName, platform);
};

module.exports = config;

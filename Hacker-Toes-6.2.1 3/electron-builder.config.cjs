const { execFileSync } = require('node:child_process');

function detectGitHubRepository() {
  const configured = process.env.GITHUB_REPOSITORY || process.env.HACKER_TOES_GITHUB_REPOSITORY;
  if (configured && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(configured)) return configured.replace(/\.git$/i, '');
  try {
    const remote = execFileSync('git', ['config', '--get', 'remote.origin.url'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const match = remote.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i);
    if (match) return `${match[1]}/${match[2].replace(/\.git$/i, '')}`;
  } catch { /* A local source ZIP may not have a Git remote yet. */ }
  return '';
}

const githubRepository = detectGitHubRepository();
const [githubOwner, githubRepo] = githubRepository.split('/');

module.exports = {
  appId: 'app.hackertoes.desktop',
  productName: 'Hacker Toes',
  directories: {
    output: 'release'
  },
  asar: true,
  asarUnpack: ['electron/windows-system-volume.ps1'],
  files: [
    '!test/**',
    '!tools/**',
    '!data/**',
    '!release/**',
    '!coverage/**',
    '!**/*.md',
    '!**/*.log',
    '!**/*.zip',
    '!**/*.7z',
    '!**/*.rar',
    '!**/.env',
    '!**/.env.*',
    '!**/cloudflare-token.txt',
    '!**/.git/**',
    '!**/.DS_Store'
  ],
  extraMetadata: {
    main: 'electron/main.cjs'
  },
  mac: {
    icon: 'build/icon.icns',
    category: 'public.app-category.social-networking',
    target: [
      { target: 'dmg', arch: ['x64', 'arm64'] },
      { target: 'zip', arch: ['x64', 'arm64'] }
    ],
    hardenedRuntime: true,
    gatekeeperAssess: false,
    extendInfo: {
      NSMicrophoneUsageDescription: 'Hacker Toes uses your microphone for one-to-one voice calls.',
      NSCameraUsageDescription: 'Hacker Toes uses your camera when you choose to enable video during a call.',
      NSScreenCaptureUsageDescription: 'Hacker Toes can share a screen or window when you explicitly select one during a call.'
    }
  },
  dmg: {
    sign: true,
    title: 'Hacker Toes ${version}'
  },
  win: {
    icon: 'build/icon.ico',
    target: [
      { target: 'nsis', arch: ['x64', 'arm64'] }
    ]
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    runAfterFinish: true,
    deleteAppDataOnUninstall: false,
    artifactName: '${productName}-${version}-${arch}-Setup.${ext}'
  },
  // Only configure a publisher when this source checkout has a GitHub repository.
  // Local ZIP builds use --publish never and must not generate updater metadata.
  ...(githubOwner && githubRepo ? {
    publish: [{ provider: 'github', owner: githubOwner, repo: githubRepo, releaseType: 'draft' }]
  } : {})
};

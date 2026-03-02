module.exports = {
  apps: [
    {
      name: 'showrunner-web',
      cwd: '/root/.openclaw/workspace/showrunner/web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3100',
      env: {
        NODE_ENV: 'production',
        PORT: '3100',
      },
    },
    {
      name: 'showrunner-worker',
      cwd: '/root/.openclaw/workspace/showrunner/worker',
      script: 'node_modules/.bin/tsx',
      args: 'src/index.ts',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};

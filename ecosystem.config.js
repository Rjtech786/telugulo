// PM2 process config for the Next.js app on EC2.
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup
//
// Runs alongside (does NOT touch) the existing n8n + telugulo-news-bot.
module.exports = {
  apps: [
    {
      name: "telugulo-next",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};

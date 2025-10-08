module.exports = {
  apps: [
    {
      name: 'navalivay-api',
      script: 'index.js',
      cwd: __dirname,
env: {
        NODE_ENV: 'production',
        PORT: '8080',
        // You can also set DATABASE_FILE absolute path if needed
        // DATABASE_FILE: '/var/www/navalivay/server/data/navalivay.db',
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      out_file: 'logs/api-out.log',
      error_file: 'logs/api-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'navalivay-bot',
      script: 'bot.js',
      cwd: __dirname,
env: {
        NODE_ENV: 'production',
        // BOT_TOKEN must be set in environment or PM2 ecosystem
        // BASE_URL can be set to your public site URL
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '150M',
      out_file: 'logs/bot-out.log',
      error_file: 'logs/bot-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}

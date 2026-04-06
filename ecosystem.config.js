// ecosystem.config.js
module.exports = {
  apps: [
    {
      name:         'sycom-portal',
      script:       'node_modules/.bin/next',
      args:         'start',
      cwd:          '/var/www/sycom-portal',
      instances:    2,               // use 'max' for all CPU cores
      exec_mode:    'cluster',
      watch:        false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT:     3000,
      },
      error_file:   '/var/log/sycom-portal/error.log',
      out_file:     '/var/log/sycom-portal/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}

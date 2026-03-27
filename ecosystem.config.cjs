module.exports = {
  apps: [
    {
      name: "minet-lap-tracker",
      script: "server.cjs",
      cwd: "C:\\Users\\WakaeA\\Downloads\\Minet Enterprise Lap-Tracking - zipped\\Minet Enterprise Lap-Tracking - Copy (2)",

      // Always restart on crash
      autorestart: true,

      // Restart if memory exceeds 500MB (prevents memory leaks killing the app)
      max_memory_restart: "500M",

      // Number of crash retries before PM2 gives up (0 = never give up)
      max_restarts: 0,

      // Wait 3 seconds between restarts
      restart_delay: 3000,

      // Environment variables — locks port to 3000
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },

      // Log file locations
      out_file: "C:\\pm2-logs\\minet-lap-tracker-out.log",
      error_file: "C:\\pm2-logs\\minet-lap-tracker-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    }
  ]
};
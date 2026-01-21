module.exports = {
  apps: [
    {
      name: "tnt-express-app", // Application name
      script: "./index.js", // Script to start the app
      cwd: "./", // Current working directory (optional)
      exec_mode: "fork", // Execution mode: "fork" or "cluster"
      instances: 1, // Number of instances to run (or a specific number)
      autorestart: true, // Automatically restart the app if it crashes
      watch: false, // Watch for file changes and restart the app (good for development)
      max_memory_restart: "500M", // Restart the app if it exceeds a memory limit
      merge_logs: true, // Merge logs from all instances
      time: true, // Add timestamps to logs

      env: {
        // Default environment variables
        NODE_ENV: "development",
        PORT: 8000,
      },
      env_production: {
        // Environment variables for the "production" environment
        NODE_ENV: "production",
        PORT: 8080,
      },
    },
  ],
};

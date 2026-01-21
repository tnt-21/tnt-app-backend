module.exports = {
  apps: [
    {
      name: "my-app", // Application name
      script: "./server.js", // Script to start the app
      cwd: "./", // Current working directory (optional)
      exec_mode: "cluster", // Execution mode: "fork" or "cluster"
      instances: "max", // Number of instances to run (or a specific number)
      autorestart: true, // Automatically restart the app if it crashes
      watch: false, // Watch for file changes and restart the app (good for development)
      max_memory_restart: "1G", // Restart the app if it exceeds a memory limit
      merge_logs: true, // Merge logs from all instances
      error_file: "../logs/my-app-error.log", // Error log path
      out_file: "../logs/my-app-output.log", // Output log path
      time: true, // Add timestamps to logs

      env: {
        // Default environment variables
        NODE_ENV: "development",
        PORT: 3000,
      },
      env_production: {
        // Environment variables for the "production" environment
        NODE_ENV: "production",
        PORT: 8080,
      },
    },
  ],
};

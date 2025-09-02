module.exports = {
  apps: [{
    name: 'car-inventory-backend',
    script: 'src/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    
    // Environment configurations
    env: {
      NODE_ENV: 'development',
      PORT: 5000
    },
    
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000,
      HOST: '0.0.0.0'
    },
    
    // Logging configuration
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Performance settings
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    
    // Auto restart settings
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'temp'],
    
    // Advanced settings
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    
    // Health monitoring
    health_check_grace_period: 3000,
    
    // Environment variables (can be overridden by .env file)
    env_file: '.env'
  }],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'https://github.com/your-username/car-inventory-backend.git',
      path: '/var/www/car-inventory-backend',
      'pre-deploy-local': '',
      'post-deploy': 'npm ci --only=production && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};

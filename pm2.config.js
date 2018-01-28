const env = require('./env');

module.exports = {
  apps: [
    {
      name: 'skylapse-hays',
      script: env.PROJECT_ROOT + '/bin/www',
      env,
    },
  ]
};
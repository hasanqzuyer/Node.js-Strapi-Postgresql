module.exports = ({ env }) => ({
  email: {
    enabled: true,
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('SMTP_HOST', 'smtp.example.com'),
        port: env('SMTP_PORT', 587),
        auth: {
          user: env('SMTP_USERNAME'),
          pass: env('SMTP_PASSWORD'),
        },
        pool: true,
        logger: true,
        debug: true,
        maxConnections: 10000
      },

      settings: {
        defaultFrom: env('DEFAULT_EMAIL'),
        defaultReplyTo: env('DEFAULT_EMAIL'),
      },
    },
  },
});

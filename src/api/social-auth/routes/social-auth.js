module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/social-auth',
      handler: 'social-auth.signup',
    },
  ],
};

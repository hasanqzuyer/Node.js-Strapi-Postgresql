module.exports = {
  routes: [
    {
     method: 'POST',
     path: '/send-notifications',
     handler: 'send-notifications.sendNotifications',
     config: {
       policies: [],
       middlewares: [],
     },
    },
  ],
};

'use strict';

/**
 * A set of functions called "actions" for `send-notifications`
 */
const admin = require("firebase-admin");
// @ts-ignore
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
// @ts-ignore
strapi.firebase = admin;

module.exports = {
  sendNotifications: async (ctx, next) => {
    try {
      // @ts-ignore
      const res = await strapi.firebase.messaging().send(ctx.request.body);
      if (res) {
        console.log({ res });
        return res;
      }
    } catch (error) {
      console.log({ error });
    }
  },

  sendNotificationsForCronJob: async (ctx, next) => {
    // @ts-ignore
    try {
      // @ts-ignore
      const res = await strapi.firebase.messaging().send(ctx);
      if (res) {
        console.log({ res });
        return res;
      }
    } catch (error) {
      console.log({ error });
    }
  },


};


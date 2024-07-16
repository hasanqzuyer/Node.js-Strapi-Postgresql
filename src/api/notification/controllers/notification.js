'use strict';

/**
 * notification controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::notification.notification', ({ strapi }) => ({
    statusNotification: async (ctx, next) => {
        const user = ctx.state.user;
        // @ts-ignore
        const { id } = ctx.request.params

        const arr = await strapi.entityService.findMany("plugin::users-permissions.user", {
            fields: ['id']
        })

        // @ts-ignore
        if (arr.find((item) => item.id === user.id)) {
            const event = await strapi.entityService.update("api::notification.notification", id, {
                data: {
                    status: 'true'
                }
            })
            return true;
        }

    },
    updateStatus: async (ctx, next) => {
        const user = ctx.state.user;
        // @ts-ignore
        const arr = await strapi.entityService.findMany("api::notification.notification", {
            fields: ['title', 'description', 'date', 'time', 'status'],
            filters: { notificationOwner: user.id }
        })

        if (arr.length > 0) {
            let result = [];
            // @ts-ignore
            const newArr = arr.map((item) => ({ ...item, status: 'true' }));
            for (let item of newArr) {
                try {
                    const res = await strapi.entityService.update("api::notification.notification", item.id, {
                        data: {
                            status: 'true',
                        }
                    })
                    if (res) {
                        return 'success';
                    }
                } catch (error) {
                    console.log("error::", error);
                }
            }
         }
    },
}));

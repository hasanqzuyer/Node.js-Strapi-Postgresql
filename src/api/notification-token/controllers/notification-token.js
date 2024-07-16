'use strict';

const { v4 } = require('uuid');
const utils = require("@strapi/utils");
const { ValidationError, ApplicationError } = utils.errors;
/**
 * notification-token controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::notification-token.notification-token', ({ strapi }) => ({

    async create(ctx, next) {
        const user = ctx.state.user
        // @ts-ignore
        const { notification_token } = ctx.request.body;

        const notificationTokens = await strapi.entityService.findMany("api::notification-token.notification-token", {
            fields: ['notification_token'],
            populate: ['owner'],
            filters: { notification_token }
        })

        if (notificationTokens.length > 0) {
            if (notificationTokens[0].owner) {
                if (user.id !== notificationTokens[0].owner.id) {
                    try {
                        const res = await strapi.entityService.update("api::notification-token.notification-token", notificationTokens[0].id, {
                            data: {
                                owner: user.id,
                            }
                        })
                        if (res) {

                            return { res };
                        } else {
                            return false;
                        }
                    } catch (error) {
                        console.log("error::", error);
                    }
                } else {
                    return true;
                }
            }
        } else {
            try {
                const result = await strapi.entityService.create("api::notification-token.notification-token", {
                    data: {
                        owner: user.id,
                        notification_token: notification_token,
                    }
                })
                if (result) {
                    return {
                        result,
                    };
                }
            } catch (error) {
                console.log(error);
            }
        }

    }
}));

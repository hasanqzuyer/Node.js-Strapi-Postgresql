'use strict';

/**
 * notification-token service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::notification-token.notification-token');

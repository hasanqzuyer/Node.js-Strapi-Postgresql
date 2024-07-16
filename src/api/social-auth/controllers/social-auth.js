'use strict';

/**
 * A set of functions called "actions" for `social-auth`
 */


const _ = require('lodash');

const { getService } = require('./utils');
const { concat, compact, isArray } = require('lodash/fp');
const utils = require('@strapi/utils');
const {
  contentTypes: { getNonWritableAttributes },
} = require('@strapi/utils');

const { sanitize } = utils;
const { ApplicationError, ValidationError, ForbiddenError } = utils.errors;

const sanitizeUser = (user, ctx) => {
  const { auth } = ctx.state;
  const userSchema = strapi.getModel('plugin::users-permissions.user');

  return sanitize.contentAPI.output(user, userSchema, { auth });
};


module.exports = {
  signup: async (ctx, next) => {
    const pluginStore = await strapi.store({ type: 'plugin', name: 'users-permissions' });

    const settings = await pluginStore.get({ key: 'advanced' });

    //@ts-ignore
    if (!settings.allow_register) {
      throw new ApplicationError('Register action is currently disabled');
    }

    //@ts-ignore
    const { register } = strapi.config.get('plugin.users-permissions');
    const alwaysAllowedKeys = ['username', 'password', 'email'];
    const userModel = strapi.contentTypes['plugin::users-permissions.user'];
    const { attributes } = userModel;

    const nonWritable = getNonWritableAttributes(userModel);

    const allowedKeys = compact(
      concat(
        alwaysAllowedKeys,
        isArray(register?.allowedFields)
          ? // Note that we do not filter allowedFields in case a user explicitly chooses to allow a private or otherwise omitted field on registration
          register.allowedFields // if null or undefined, compact will remove it
          : // to prevent breaking changes, if allowedFields is not set in config, we only remove private and known dangerous user schema fields
          // TODO V5: allowedFields defaults to [] when undefined and remove this case
          Object.keys(attributes).filter(
            (key) =>
              !nonWritable.includes(key) &&
              //@ts-ignore
              !attributes[key].private &&
              ![
                // many of these are included in nonWritable, but we'll list them again to be safe and since we're removing this code in v5 anyway
                // Strapi user schema fields
                'confirmed',
                'blocked',
                'confirmationToken',
                'resetPasswordToken',
                'provider',
                'id',
                'role',
                // other Strapi fields that might be added
                'createdAt',
                'updatedAt',
                'createdBy',
                'updatedBy',
                'publishedAt', // d&p
                'strapi_reviewWorkflows_stage', // review workflows
              ].includes(key)
          )
      )
    );

    const params = {
      ..._.pick(ctx.request.body, allowedKeys),
      provider: 'local',
    };

    const provider = params.provider || 'local';

    const role = await strapi
      .query('plugin::users-permissions.role')
      //@ts-ignore
      .findOne({ where: { type: settings.default_role } });

    if (!role) {
      throw new ApplicationError('Impossible to find the default role');
    }

    // @ts-ignore
    const { email, username } = params;

    const identifierFilter = {
      email: email.toLowerCase()
    };

    const conflictingUserCount = await strapi.query('plugin::users-permissions.user').count({
      where: { ...identifierFilter },
    });

    if (conflictingUserCount > 0) {
      // throw new ApplicationError('Email is already taken');


      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: {
          provider,
          $or: [{ email: ctx.request.body.email.toLowerCase() }],
        },
      });
      const updateUser = await strapi.entityService.update('plugin::users-permissions.user', user.id, {
        data: {
          user_avatar: ctx.request.body.user_avatar
        },
      });
      const sanitizedUser = await sanitizeUser(updateUser, ctx);
      const jwt = getService('jwt').issue(_.pick(user, ['id']));

      return ctx.send({
        jwt,
        user: sanitizedUser,
      });

    }

    const newUser = {
      ...params,
      role: role.id,
      email: email.toLowerCase(),
      username,
      // @ts-ignore
      confirmed: true,
    };

    const user = await getService('user').add(newUser);

    const sanitizedUser = await sanitizeUser(user, ctx);
    const jwt = getService('jwt').issue(_.pick(user, ['id']));

    return ctx.send({
      jwt,
      user: sanitizedUser,
    });


  },

};

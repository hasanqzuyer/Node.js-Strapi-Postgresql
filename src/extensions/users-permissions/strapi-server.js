"use strict";
const { v4 } = require('uuid');
const _ = require('lodash');

const { getService } = require('./utils');
const { concat, compact, isArray } = require('lodash/fp');
const utils = require('@strapi/utils');
const {
    contentTypes: { getNonWritableAttributes },
} = require('@strapi/utils');
const {
    validateCallbackBody, validateChangePasswordBody, validateRegisterBody, validateForgotPasswordBody, validateEmailConfirmationBody,
    validateSendEmailConfirmationBody,

} = require('./validation/auth');

const crypto = require('crypto');
// @ts-ignore
// @ts-ignore
// @ts-ignore
const bcrypt = require('bcryptjs');
const urlJoin = require('url-join');
const { getAbsoluteAdminUrl, getAbsoluteServerUrl } = require('@strapi/utils');



const { sanitize } = utils;
const { ApplicationError, ValidationError, ForbiddenError } = utils.errors;

const sanitizeUser = (user, ctx) => {
    const { auth } = ctx.state;
    const userSchema = strapi.getModel('plugin::users-permissions.user');

    return sanitize.contentAPI.output(user, userSchema, { auth });
};

// @ts-ignore
module.exports = (plugin) => {


    const getProfile = async (provider, query) => {
        const accessToken = query.access_token || query.code || query.oauth_token;

        const providers = await strapi
            .store({ type: 'plugin', name: 'users-permissions', key: 'grant' })
            // @ts-ignore
            .get();

        return getService('providers-registry').run({
            provider,
            query,
            accessToken,
            providers,
        });
    };



    /**
     * Rewrite of connect method.
     * OVERRIDE: https://github.com/strapi/strapi/blob/master/packages/plugins/users-permissions/server/services/providers.js#L44
     * @param {*} provider
     * @param {*} query
     * @returns
     */
    const connect = async (provider, query) => {
        const accessToken = query.access_token || query.code || query.oauth_token;

        if (!accessToken) {
            throw new Error('No access_token.');
        }

        // Get the profile.
        const profile = await getProfile(provider, query);

        const email = _.toLower(profile.email);

        // We need at least the mail.
        if (!email) {
            throw new Error('Email was not available.');
        }

        const user = await strapi.query('plugin::users-permissions.user').findOne({
            where: { email },
        });

        const advancedSettings = await strapi
            .store({ type: 'plugin', name: 'users-permissions', key: 'advanced' })
            // @ts-ignore
            .get();

        // @ts-ignore
        if (_.isEmpty(user) && !advancedSettings.allow_register) {
            throw new Error('Register action is actually not available.');
        }

        if (!_.isEmpty(user)) {
            const updateUser = await strapi.entityService.update('plugin::users-permissions.user', user.id, {
                data: profile,
                populate: ['role'],
            });
            return updateUser;
        }


        // Retrieve default role.
        const defaultRole = await strapi
            .query('plugin::users-permissions.role')
            // @ts-ignore
            .findOne({ where: { type: advancedSettings.default_role } });

        // Create the new user.
        const newUser = {
            ...profile,
            email, // overwrite with lowercased email
            role: defaultRole.id,
            provider,
            confirmed: true,
        };
        const createdUser = await strapi
            .query('plugin::users-permissions.user')
            .create({ data: newUser });

        const today = new Date();
        let key = "key_" + v4();
        const startdate = today.toISOString().split('T')[0];
        const enddate = new Date(today.setFullYear(today.getFullYear() + 1)).toISOString().split('T')[0];

        // @ts-ignore
        await strapi.entityService.create("api::api-key.api-key", {
            data: {
                start_date: startdate,
                end_date: enddate,
                key: key,
                checkout_session: "free of charge",
                total_car_reports: 1,
                total_market_reports: 0,
                owner: createdUser.id,
            }
        })
        return createdUser;
    };
    const edit = async (userId, params = {}) => {
        return strapi.entityService.update('plugin::users-permissions.user', userId, {
            data: params,
            populate: ['role'],
        });
    };

    // @ts-ignore
    const mobileSendConfirmationEmail = async (user) => {
        const userPermissionService = getService('users-permissions');
        const pluginStore = await strapi.store({ type: 'plugin', name: 'users-permissions' });
        const userSchema = strapi.getModel('plugin::users-permissions.user');

        const settings = await pluginStore
            .get({ key: 'email' })
            // @ts-ignore
            .then((storeEmail) => storeEmail.email_confirmation.options);

        // Sanitize the template's user information
        const sanitizedUserInfo = await sanitize.sanitizers.defaultSanitizeOutput(userSchema, user);

        const confirmationToken = crypto.randomInt(1000, 9999).toString();

        await edit(user.id, { confirmationToken });

        const apiPrefix = strapi.config.get('api.rest.prefix');

        try {
            settings.message = await userPermissionService.template(settings.message, {
                // @ts-ignore
                URL: urlJoin(getAbsoluteServerUrl(strapi.config), apiPrefix, '/auth/email-confirmation'),
                SERVER_URL: getAbsoluteServerUrl(strapi.config),
                ADMIN_URL: getAbsoluteAdminUrl(strapi.config),
                USER: sanitizedUserInfo,
                CODE: confirmationToken,
            });

            settings.object = await userPermissionService.template(settings.object, {
                USER: sanitizedUserInfo,
            });
        } catch {
            strapi.log.error(
                '[plugin::users-permissions.sendConfirmationEmail]: Failed to generate a template for "user confirmation email". Please make sure your email template is valid and does not contain invalid characters or patterns'
            );
            return;
        }
        const message = ` <h2>Verification Code</h2>

                            <p>You have to input the Verification Code.</p>
                            
                            <h4>${confirmationToken}</h4>
                            
                            <p>Thanks.</p>`
        // Send an email to the user.
        await strapi
            .plugin('email')
            .service('email')
            .send({
                to: user.email,
                from:
                    settings.from.email && settings.from.name
                        ? `${settings.from.name} <${settings.from.email}>`
                        : undefined,
                replyTo: settings.response_email,
                subject: settings.object,
                text: message,
                html: message,
            });
    };

    // @ts-ignore
    const sendConfirmationEmail = async (user) => {
        const userPermissionService = getService('users-permissions');
        const pluginStore = await strapi.store({ type: 'plugin', name: 'users-permissions' });
        const userSchema = strapi.getModel('plugin::users-permissions.user');

        const settings = await pluginStore
            .get({ key: 'email' })
            // @ts-ignore
            .then((storeEmail) => storeEmail.email_confirmation.options);

        // Sanitize the template's user information
        const sanitizedUserInfo = await sanitize.sanitizers.defaultSanitizeOutput(userSchema, user);

        const confirmationToken = crypto.randomBytes(20).toString('hex');

        await edit(user.id, { confirmationToken });

        const apiPrefix = strapi.config.get('api.rest.prefix');

        try {
            settings.message = await userPermissionService.template(settings.message, {
                // @ts-ignore
                URL: urlJoin(getAbsoluteServerUrl(strapi.config), apiPrefix, '/auth/email-confirmation'),
                SERVER_URL: getAbsoluteServerUrl(strapi.config),
                ADMIN_URL: getAbsoluteAdminUrl(strapi.config),
                USER: sanitizedUserInfo,
                CODE: confirmationToken,
            });

            settings.object = await userPermissionService.template(settings.object, {
                USER: sanitizedUserInfo,
            });
        } catch {
            strapi.log.error(
                '[plugin::users-permissions.sendConfirmationEmail]: Failed to generate a template for "user confirmation email". Please make sure your email template is valid and does not contain invalid characters or patterns'
            );
            return;
        }

        // Send an email to the user.
        await strapi
            .plugin('email')
            .service('email')
            .send({
                to: user.email,
                from:
                    settings.from.email && settings.from.name
                        ? `${settings.from.name} <${settings.from.email}>`
                        : undefined,
                replyTo: settings.response_email,
                subject: settings.object,
                text: settings.message,
                html: settings.message,
            });
    };



    /**
     * Rewrite of callback method.
     * OVERRIDE: https://github.com/strapi/strapi/blob/master/packages/core/content-manager/server/controllers/collection-types.js
     * IMPORTANT: this should be reviewd and updated in Strapi version bumps.
     * Added lines are marked with comments starting with OVERRIDE
     * @param {*} ctx
     * @returns
     */
    // @ts-ignore
    plugin.controllers["auth"].callback = async (ctx) => {
        const provider = ctx.params.provider || 'local';
        const params = ctx.request.body;

        const store = strapi.store({ type: 'plugin', name: 'users-permissions' });
        const grantSettings = await store.get({ key: 'grant' });

        const grantProvider = provider === 'local' ? 'email' : provider;

        if (!_.get(grantSettings, [grantProvider, 'enabled'])) {
            throw new ApplicationError('This provider is disabled');
        }

        if (provider === 'local') {
            await validateCallbackBody(params);

            const { identifier } = params;

            // Check if the user exists.
            const user = await strapi.query('plugin::users-permissions.user').findOne({
                where: {
                    $or: [{ email: identifier.toLowerCase() }, { username: identifier }],
                },
            });

            if (!user) {
                throw new ValidationError('Invalid email or password');
            }

            if (!user.password) {
                throw new ValidationError('Invalid email or password');
            }

            const validPassword = await getService('user').validatePassword(
                params.password,
                user.password
            );

            if (!validPassword) {
                throw new ValidationError('Invalid email or password');
            }

            // const advancedSettings = await store.get({ key: 'advanced' });
            // const requiresConfirmation = _.get(advancedSettings, 'email_confirmation');

            // if (requiresConfirmation && user.confirmed !== true) {
            //     throw new ApplicationError('Your account email is not confirmed');
            // }

            if (user.blocked === true) {
                throw new ApplicationError('Your account has been blocked by an administrator');
            }

            return ctx.send({
                jwt: getService('jwt').issue({ id: user.id }),
                user: await sanitizeUser(user, ctx),
            });
        }

        // Connect the user with the third-party provider.
        try {
            const user = await connect(provider, ctx.query);

            if (user.blocked) {
                throw new ForbiddenError('Your account has been blocked by an administrator');
            }

            return ctx.send({
                jwt: getService('jwt').issue({ id: user.id }),
                user: await sanitizeUser(user, ctx),
            });
        } catch (error) {
            throw new ApplicationError(error.message);
        }
    };

    /**
   * Rewrite of callback method.
   * OVERRIDE: https://github.com/strapi/strapi/blob/master/packages/core/content-manager/server/controllers/collection-types.js
   * IMPORTANT: this should be reviewd and updated in Strapi version bumps.
   * Added lines are marked with comments starting with OVERRIDE
   * @param {*} ctx
   * @returns
   */
    plugin.controllers["auth"].changePassword = async (ctx) => {
        if (!ctx.state.user) {
            throw new ApplicationError('You must be authenticated to reset your password');
        }
        const { currentPassword, password } = await validateChangePasswordBody(ctx.request.body);

        const user = await strapi.entityService.findOne(
            'plugin::users-permissions.user',
            ctx.state.user.id
        );
        if (user.provider !== 'local') {
            await getService('user').edit(user.id, { password });

            ctx.send({
                jwt: getService('jwt').issue({ id: user.id }),
                user: await sanitizeUser(user, ctx),
            });
        } else {

            const validPassword = await getService('user').validatePassword(currentPassword, user.password);

            if (!validPassword) {
                throw new ValidationError('The provided current password is invalid');
            }

            if (currentPassword === password) {
                throw new ValidationError('Your new password must be different than your current password');
            }

            await getService('user').edit(user.id, { password });

            ctx.send({
                jwt: getService('jwt').issue({ id: user.id }),
                user: await sanitizeUser(user, ctx),
            });
        }
    };

    /**
* Rewrite of callback method.
* OVERRIDE: https://github.com/strapi/strapi/blob/master/packages/core/content-manager/server/controllers/collection-types.js
* IMPORTANT: this should be reviewd and updated in Strapi version bumps.
* Added lines are marked with comments starting with OVERRIDE
* @param {*} ctx
* @returns
*/
    plugin.controllers["auth"].register = async (ctx) => {
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

        await validateRegisterBody(params);

        const role = await strapi
            .query('plugin::users-permissions.role')
            //@ts-ignore
            .findOne({ where: { type: settings.default_role } });

        if (!role) {
            throw new ApplicationError('Impossible to find the default role');
        }

        // @ts-ignore
        const { email, username, provider } = params;

        const identifierFilter = {
            email: email.toLowerCase()
        };

        const conflictingUserCount = await strapi.query('plugin::users-permissions.user').count({
            where: { ...identifierFilter },
        });

        if (conflictingUserCount > 0) {
            throw new ApplicationError('Email is already taken');
        }

        const newUser = {
            ...params,
            role: role.id,
            email: email.toLowerCase(),
            username,
            // @ts-ignore
            confirmed: false,
        };

        const user = await getService('user').add(newUser);

        const sanitizedUser = await sanitizeUser(user, ctx);
        // @ts-ignore
        // @ts-ignore
        if (ctx.request.body.type === 'mobile') {
            try {
                await mobileSendConfirmationEmail(sanitizedUser);
            } catch (err) {
                throw new ApplicationError(err.message);
            }
        } else {
            try {
                await getService('user').sendConfirmationEmail(sanitizedUser);
            } catch (err) {
                throw new ApplicationError(err.message);
            }
        }
        const jwt = getService('jwt').issue(_.pick(user, ['id']));

        return ctx.send({
            jwt,
            user: sanitizedUser,
        });
    };

    plugin.controllers["auth"].forgotPassword = async (ctx) => {
        const { email } = ctx.request.body;

        const pluginStore = await strapi.store({ type: 'plugin', name: 'users-permissions' });

        const emailSettings = await pluginStore.get({ key: 'email' });
        const advancedSettings = await pluginStore.get({ key: 'advanced' });

        // Find the user by email.
        const user = await strapi
            .query('plugin::users-permissions.user')
            .findOne({ where: { email: email.toLowerCase() } });

        if (!user || user.blocked) {
            return ctx.send({ ok: true });
        }

        // Generate random token.
        const userInfo = await sanitizeUser(user, ctx);

        let resetPasswordToken = '';
        if (ctx.request.body.type === 'mobile') {
            resetPasswordToken = crypto.randomInt(1000, 9999).toString();
        } else {
            resetPasswordToken = crypto.randomBytes(64).toString('hex');
        }

        const resetPasswordSettings = _.get(emailSettings, 'reset_password.options', {});
        const emailBody = await getService('users-permissions').template(
            // @ts-ignore
            resetPasswordSettings.message,
            {
                // @ts-ignore
                URL: advancedSettings.email_reset_password,
                SERVER_URL: getAbsoluteServerUrl(strapi.config),
                ADMIN_URL: getAbsoluteAdminUrl(strapi.config),
                USER: userInfo,
                TOKEN: resetPasswordToken,
            }
        );


        const emailObject = await getService('users-permissions').template(
            // @ts-ignore
            resetPasswordSettings.object,
            {
                USER: userInfo,
            }
        );

        const message = `<h2>Verification Code</h2>

                        <p>You have to input the Verification Code.</p>
                        <p>${resetPasswordToken}</p>
                        
                        <p>Thanks.</p>`

        const emailToSend = {
            to: user.email,
            from:
                // @ts-ignore
                resetPasswordSettings.from.email || resetPasswordSettings.from.name
                    // @ts-ignore
                    ? `${resetPasswordSettings.from.name} <${resetPasswordSettings.from.email}>`
                    : undefined,
            // @ts-ignore
            replyTo: resetPasswordSettings.response_email,
            subject: emailObject,
            text: ctx.request.body.type === 'mobile' ? message : emailBody,
            html: ctx.request.body.type === 'mobile' ? message : emailBody,
        };

        // NOTE: Update the user before sending the email so an Admin can generate the link if the email fails
        await getService('user').edit(user.id, { resetPasswordToken });

        // Send an email to the user.
        await strapi.plugin('email').service('email').send(emailToSend);

        ctx.send({ ok: true });
    };

    plugin.controllers["auth"].emailConfirmation = async (ctx, next, returnUser) => {
        const { confirmation: confirmationToken } = await validateEmailConfirmationBody(ctx.query);

        const userService = getService('user');
        const jwtService = getService('jwt');

        const [user] = await userService.fetchAll({ filters: { confirmationToken } });

        if (!user) {
            throw new ValidationError('Invalid token');
        }

        await userService.edit(user.id, { confirmed: true, confirmationToken: null });

        if (returnUser) {
            ctx.send({
                jwt: jwtService.issue({ id: user.id }),
                user: await sanitizeUser(user, ctx),
            });
        } else {
            const settings = await strapi
                .store({ type: 'plugin', name: 'users-permissions', key: 'advanced' })
                // @ts-ignore
                .get();

            return ctx.send({
                jwt: jwtService.issue({ id: user.id }),
                user: await sanitizeUser(user, ctx),
            });
        }
    };


    plugin.controllers["auth"].sendEmailConfirmation = async (ctx) => {
        const { email } = await validateSendEmailConfirmationBody(ctx.request.body);

        const user = await strapi.query('plugin::users-permissions.user').findOne({
            where: { email: email.toLowerCase() },
        });

        if (!user) {
            return ctx.send({ email, sent: true });
        }

        // if (user.confirmed) {
        //     throw new ApplicationError('Already confirmed');
        // }

        if (user.blocked) {
            throw new ApplicationError('User blocked');
        }


        await mobileSendConfirmationEmail(user);

        ctx.send({
            email: user.email,
            sent: true,
        });
    };


    return plugin;
};
'use strict';

/**
 * `is-owner` policy
 */
const utils = require("@strapi/utils")
const {PolicyError} = utils.errors

module.exports = async (policyContext, config, { strapi }) => {
  const { id } = policyContext.request.params
  const user = policyContext.state.user
  const order = await strapi.entityService.findOne("api::chat.chat", id, {
    populate: ["owner"]
  })

  if(order.owner.id === user.id){
    // Go ahead to excecute
    return true;
  }
  // throw policy error
  throw new PolicyError("Thou shall not pass!")
};

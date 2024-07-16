'use strict';
const axios = require('axios');
const { v4 } = require('uuid');
/**
 * chat controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
module.exports = createCoreController('api::chat.chat', ({ strapi }) => ({
  getAllChats: async (ctx, next) => {
    const user = ctx.state.user
    const chats = await strapi.entityService.findMany("api::chat.chat", {
      fields: ['title', 'chat_id', 'updatedAt'],
      filters: { owner: user.id }
    })

    return { chats }
  },

  getChatGPTmessages: async (ctx, next) => {
    // @ts-ignore
    const { message } = ctx.request.body
    const user = ctx.state.user
    const headers = { "x-api-key": 'testkey12345', "uname": user.username, 'Content-Type': 'application/json' }

    const url = `${process.env.EXTERNAL_API_URL}/send_message`;
    const body = { message }
    // fetch data from external API
    try {
      const { data } = await axios.post(url, body, {
        headers
      });
      return {
        message: data
      }
    } catch (error) {
      console.log(error);
      return {
        message: "Sorry, there was some internal server issue!"
      }
    }
  },

  updateChat: async (ctx, next) => {
    // @ts-ignore
    const { id } = ctx.request.params
    // @ts-ignore
    const { newChat } = ctx.request.body
    const chat = await strapi.entityService.update("api::chat.chat", id, {
      data: {
        title: newChat.title,
        messages: newChat.messages
      }
    })
    return { chat }
  },

  deleteChat: async (ctx, next) => {
    // @ts-ignore
    const { id } = ctx.request.params
    const chat = await strapi.entityService.delete("api::chat.chat", id)
    return { chat }
  },

  async create(ctx, next) {
    const user = ctx.state.user
    // @ts-ignore
    const { newChat } = ctx.request.body
    let chat_id = v4();
    chat_id = chat_id.replace(/-/g, "");
    const chat = await strapi.entityService.create("api::chat.chat", {
      data: {
        title: newChat.title,
        messages: newChat.messages,
        chat_id: chat_id,
        owner: user.id
      }
    })
    return { chat }
  }
}));

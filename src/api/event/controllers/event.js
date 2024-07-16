'use strict';

/**
 * event controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::event.event', ({ strapi }) => ({
  getUpcomingEvents: async (ctx, next) => {
    const user = ctx.state.user

    try {
      const events = await strapi.entityService.findMany("api::event.event", {
        fields: ['title', 'description', 'start', 'end', 'color', 'event_id', 'allDay', 'rrule_text', 'repeat_data', 'duration', 'action', 'synced_with_google'],
        filters: { owner: user.id, deleted: false }
      })
      if (events) {
        return { events }
      }
    } catch (error) {
      console.log({ error })
    }

  },

  getNotSycedEvents: async (ctx, next) => {
    const user = ctx.state.user
    const events = await strapi.entityService.findMany("api::event.event", {
      fields: ['title', 'description', 'start', 'end', 'color', 'event_id', 'allDay', 'rrule_text', 'repeat_data', 'duration', 'action'],
      filters: { owner: user.id, synced_with_google: false }
    })

    return { events }
  },

  syncEventwithGoogle: async (ctx, next) => {
    // @ts-ignore
    const { id } = ctx.request.params
    // @ts-ignore
    const { newEvent } = ctx.request.body
    const event = await strapi.entityService.update("api::event.event", id, {
      data: {
        synced_with_google: true,
        event_id: newEvent.event_id,
      }
    })

    if (event.action === 'delete' && event.deleted) {
      await strapi.entityService.delete("api::event.event", id)
    }
    return { event }
  },

  updateEvent: async (ctx, next) => {
    // @ts-ignore
    const { id } = ctx.request.params
    // @ts-ignore
    const { newEvent } = ctx.request.body
    const event = await strapi.entityService.update("api::event.event", id, {
      data: {
        title: newEvent.title,
        description: newEvent.description,
        start: newEvent.start,
        end: newEvent.end,
        color: newEvent.color,
        rrule_text: newEvent.rrule_text,
        repeat_data: newEvent.repeat_data,
        duration: newEvent.duration,
        allDay: newEvent.allDay,
        synced_with_google: false,
        action: "update",
      }
    })
    return { event }
  },

  deleteEvent: async (ctx, next) => {
    // @ts-ignore
    const { id } = ctx.request.params
    const event = await strapi.entityService.update("api::event.event", id, {
      data: {
        action: 'delete',
        deleted: true,
        synced_with_google: false,
      }
    })

    if (!event.event_id) {
      await strapi.entityService.delete("api::event.event", id)
    }
    return { event }
  },

  async create(ctx, next) {
    const user = ctx.state.user
    // @ts-ignore
    const { newEvent } = ctx.request.body
    const event = await strapi.entityService.create("api::event.event", {
      data: {
        title: newEvent.title,
        description: newEvent.description,
        start: newEvent.start,
        end: newEvent.end,
        color: newEvent.color,
        rrule_text: newEvent.rrule_text,
        repeat_data: newEvent.repeat_data,
        allDay: newEvent.allDay,
        duration: newEvent.duration,
        action: "create",
        owner: user.id
      }
    })
    return { event }
  }
}));

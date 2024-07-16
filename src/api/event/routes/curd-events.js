module.exports = {
  routes: [
    {
      method: "GET",
      path: "/events/get_upcomming_events",
      handler: "event.getUpcomingEvents"
    },
    {
      method: "GET",
      path: "/events/get_syncing_events",
      handler: "event.getNotSycedEvents"
    },
    {
      method: "POST",
      path: "/events/update_events/:id",
      handler: "event.updateEvent",
      config: {
        policies: ["api::event.is-owner"]
      }
    },
    {
      method: "POST",
      path: "/events/sync_event_with_google/:id",
      handler: "event.syncEventwithGoogle",
      config: {
        policies: ["api::event.is-owner"]
      }
    },
    {
      method: "POST",
      path: "/events/delete_event/:id",
      handler: "event.deleteEvent",
      config: {
        policies: ["api::event.is-owner"]
      }
    },
  ]
}

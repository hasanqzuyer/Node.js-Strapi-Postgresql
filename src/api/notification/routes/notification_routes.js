module.exports = {
  routes: [
    {
      method: "PUT",
      path: "/status-notification/:id",
      handler: "notification.statusNotification",
    },
    {
      method: "GET",
      path: "/updateStatus-Notifications",
      handler: "notification.updateStatus",
    }
  ]
}

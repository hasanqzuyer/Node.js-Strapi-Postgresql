module.exports = {
  routes: [
    {
      method: "GET",
      path: "/chat/get_all",
      handler: "chat.getAllChats",
    },
    {
      method: "POST",
      path: "/chat/message",
      handler: "chat.getChatGPTmessages",
    },
    {
      method: "POST",
      path: "/chat/update_chat/:id",
      handler: "chat.updateChat",
      config: {
        policies: ["api::chat.is-owner"]
      }
    },
    {
      method: "DELETE",
      path: "/chat/delete_chat/:id",
      handler: "chat.deleteChat",
      config: {
        policies: ["api::chat.is-owner"]
      }
    }
  ]
}

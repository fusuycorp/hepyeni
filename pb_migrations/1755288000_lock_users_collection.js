migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_");
  collection.listRule = null;
  collection.viewRule = null;
  collection.createRule = null;
  collection.updateRule = null;
  collection.deleteRule = null;
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_");
  collection.createRule = "";
  collection.updateRule = "id = @request.auth.id";
  app.save(collection);
});

migrate((app) => {
  const collection = app.findCollectionByNameOrId("group_members");
  if (!collection.indexes.some((idx) => idx.includes("idx_group_members_user"))) {
    collection.addIndex("idx_group_members_user", false, "user");
    app.save(collection);
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("group_members");
  if (collection.indexes.some((idx) => idx.includes("idx_group_members_user"))) {
    collection.removeIndex("idx_group_members_user");
    app.save(collection);
  }
});

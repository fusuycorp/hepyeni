migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("group_members");
    collection.addIndex("idx_group_members_user", false, "user");
    app.save(collection);
  } catch {
    // Migration is robust if index already exists
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("group_members");
    collection.removeIndex("idx_group_members_user");
    app.save(collection);
  } catch {
    // Robust rollback
  }
});

migrate((app) => {
  const collection = app.findCollectionByNameOrId("user_media_progress");
  collection.indexes = collection.indexes || [];
  collection.indexes.push("CREATE INDEX idx_user_progress_group_title ON user_media_progress (groupTitle, status)");
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("user_media_progress");
  if (collection.indexes) {
    collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_user_progress_group_title"));
  }
  app.save(collection);
});

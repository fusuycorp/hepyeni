/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const groups = app.findCollectionByNameOrId("groups");
  const titles = app.findCollectionByNameOrId("titles");

  const comments = new Collection({
    type: "base",
    name: "comments",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        type: "relation",
        name: "title",
        required: true,
        collectionId: titles.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      {
        type: "relation",
        name: "user",
        required: true,
        collectionId: users.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      {
        type: "relation",
        name: "group",
        required: true,
        collectionId: groups.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      { type: "text", name: "content", required: true, min: 1, max: 2000 },
      { type: "autodate", name: "createdAt", onCreate: true, onUpdate: false },
    ],
  });
  comments.addIndex("idx_comments_title", false, "title, createdAt");
  comments.addIndex("idx_comments_group", false, "group, createdAt");
  app.save(comments);
}, (app) => {
  const collection = app.findCollectionByNameOrId("comments");
  if (collection) app.delete(collection);
});

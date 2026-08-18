/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const userMediaProgress = app.findCollectionByNameOrId("user_media_progress");

  const shelfQuotes = new Collection({
    type: "base",
    name: "shelf_quotes",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
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
        name: "progressItem",
        required: false,
        collectionId: userMediaProgress ? userMediaProgress.id : "user_media_progress",
        cascadeDelete: false,
        maxSelect: 1,
      },
      {
        type: "text",
        name: "mediaType",
        required: false,
        max: 50,
      },
      {
        type: "text",
        name: "titleName",
        required: true,
        min: 1,
        max: 200,
      },
      {
        type: "text",
        name: "quoteText",
        required: true,
        min: 1,
        max: 3000,
      },
      {
        type: "text",
        name: "attribution",
        required: false,
        max: 200,
      },
      {
        type: "json",
        name: "tags",
        required: false,
      },
      {
        type: "json",
        name: "isSharedWithCircles",
        required: false,
      },
      {
        type: "autodate",
        name: "createdAt",
        onCreate: true,
        onUpdate: false,
      },
    ],
  });
  shelfQuotes.addIndex("idx_shelf_quotes_user", false, "user, createdAt");
  shelfQuotes.addIndex("idx_shelf_quotes_progress", false, "progressItem");
  app.save(shelfQuotes);
}, (app) => {
  const collection = app.findCollectionByNameOrId("shelf_quotes");
  if (collection) app.delete(collection);
});

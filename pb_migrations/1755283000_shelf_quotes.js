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
      new RelationField({
        name: "user",
        required: true,
        collectionId: users.id,
        cascadeDelete: true,
        maxSelect: 1,
      }),
      new RelationField({
        name: "progressItem",
        required: false,
        collectionId: userMediaProgress ? userMediaProgress.id : "user_media_progress",
        cascadeDelete: false,
        maxSelect: 1,
      }),
      new TextField({
        name: "mediaType",
        required: false,
        max: 50,
      }),
      new TextField({
        name: "titleName",
        required: true,
        min: 1,
        max: 200,
      }),
      new TextField({
        name: "quoteText",
        required: true,
        min: 1,
        max: 3000,
      }),
      new TextField({
        name: "attribution",
        required: false,
        max: 200,
      }),
      new JSONField({
        name: "tags",
        required: false,
      }),
      new JSONField({
        name: "isSharedWithCircles",
        required: false,
      }),
      new AutodateField({
        name: "createdAt",
        onCreate: true,
        onUpdate: false,
      }),
    ],
  });
  shelfQuotes.addIndex("idx_shelf_quotes_user", false, "user, createdAt");
  shelfQuotes.addIndex("idx_shelf_quotes_progress", false, "progressItem");
  app.save(shelfQuotes);
}, (app) => {
  const collection = app.findCollectionByNameOrId("shelf_quotes");
  if (collection) app.delete(collection);
});

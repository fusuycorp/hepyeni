/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const comments = app.findCollectionByNameOrId("comments");
  if (!comments) return;

  // Add parentId relation for +1 depth replies
  const existingField = comments.fields.getByName("parentId");
  if (!existingField) {
    comments.fields.add(
      new RelationField({
        name: "parentId",
        collectionId: comments.id,
        cascadeDelete: true,
        maxSelect: 1,
        required: false,
      }),
    );
    comments.addIndex("idx_comments_parent", false, "parentId, createdAt");
    app.save(comments);
  }
}, (app) => {
  const comments = app.findCollectionByNameOrId("comments");
  if (!comments) return;
  const existingField = comments.fields.getByName("parentId");
  if (existingField) {
    comments.fields.removeByName("parentId");
    app.save(comments);
  }
});

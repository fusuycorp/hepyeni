/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const groups = app.findCollectionByNameOrId("groups");
  const scheduleMilestones = app.findCollectionByNameOrId("schedule_milestones");

  const milestoneComments = new Collection({
    type: "base",
    name: "milestone_comments",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        type: "relation",
        name: "milestone",
        required: true,
        collectionId: scheduleMilestones.id,
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
      {
        type: "text",
        name: "content",
        required: true,
        min: 1,
        max: 2000,
      },
      {
        type: "bool",
        name: "isSpoiler",
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
  milestoneComments.addIndex("idx_milestone_comments_milestone", false, "milestone, createdAt");
  milestoneComments.addIndex("idx_milestone_comments_group", false, "group, createdAt");
  app.save(milestoneComments);
}, (app) => {
  const collection = app.findCollectionByNameOrId("milestone_comments");
  if (collection) app.delete(collection);
});

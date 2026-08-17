/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const groups = app.findCollectionByNameOrId("groups");
  const titles = app.findCollectionByNameOrId("titles");

  // 1. user_media_progress
  const userMediaProgress = new Collection({
    type: "base",
    name: "user_media_progress",
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
        name: "groupTitle",
        required: false,
        collectionId: titles.id,
        cascadeDelete: false,
        maxSelect: 1,
      },
      {
        type: "select",
        name: "mediaType",
        required: true,
        maxSelect: 1,
        values: ["book", "movie", "tv", "music", "podcast"],
      },
      { type: "text", name: "externalSource", required: false, max: 100 },
      { type: "text", name: "externalId", required: false, max: 200 },
      { type: "text", name: "title", required: true, max: 300 },
      { type: "text", name: "creator", required: false, max: 300 },
      { type: "text", name: "coverUrl", required: false, max: 2000 },
      {
        type: "select",
        name: "status",
        required: true,
        maxSelect: 1,
        values: ["in_progress", "completed", "plan_to_consume", "on_hold", "dropped"],
      },
      { type: "number", name: "progressCurrent", required: false },
      { type: "number", name: "progressTotal", required: false },
      {
        type: "select",
        name: "progressUnit",
        required: false,
        maxSelect: 1,
        values: ["pages", "chapters", "episodes", "percent", "minutes"],
      },
      { type: "text", name: "currentLabel", required: false, max: 100 },
      { type: "text", name: "notes", required: false, max: 3000 },
      { type: "number", name: "rating", required: false, min: 1, max: 5 },
      { type: "bool", name: "isSharedWithCircles", required: false },
      { type: "date", name: "startedAt", required: false },
      { type: "date", name: "completedAt", required: false },
      { type: "autodate", name: "createdAt", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updatedAt", onCreate: true, onUpdate: true },
    ],
  });
  userMediaProgress.addIndex("idx_user_progress_user", false, "user, updatedAt");
  userMediaProgress.addIndex("idx_user_progress_ext", false, "user, externalSource, externalId");
  userMediaProgress.addIndex("idx_user_progress_title", false, "user, groupTitle");
  app.save(userMediaProgress);

  // 2. group_schedules
  const groupSchedules = new Collection({
    type: "base",
    name: "group_schedules",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        type: "relation",
        name: "group",
        required: true,
        collectionId: groups.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      {
        type: "relation",
        name: "title",
        required: false,
        collectionId: titles.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      { type: "text", name: "name", required: true, max: 200 },
      { type: "text", name: "description", required: false, max: 1000 },
      { type: "date", name: "startDate", required: false },
      { type: "date", name: "targetDate", required: false },
      {
        type: "select",
        name: "status",
        required: true,
        maxSelect: 1,
        values: ["active", "completed", "archived"],
      },
      {
        type: "relation",
        name: "createdBy",
        required: true,
        collectionId: users.id,
        cascadeDelete: false,
        maxSelect: 1,
      },
      { type: "autodate", name: "createdAt", onCreate: true, onUpdate: false },
    ],
  });
  groupSchedules.addIndex("idx_schedules_group", false, "group, status, createdAt");
  app.save(groupSchedules);

  // 3. schedule_milestones
  const scheduleMilestones = new Collection({
    type: "base",
    name: "schedule_milestones",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        type: "relation",
        name: "schedule",
        required: true,
        collectionId: groupSchedules.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      { type: "text", name: "title", required: true, max: 200 },
      { type: "date", name: "targetDate", required: false },
      { type: "text", name: "targetUnit", required: false, max: 100 },
      { type: "number", name: "orderIndex", required: true },
      { type: "autodate", name: "createdAt", onCreate: true, onUpdate: false },
    ],
  });
  scheduleMilestones.addIndex("idx_milestones_schedule", false, "schedule, orderIndex");
  app.save(scheduleMilestones);

  // 4. milestone_checkins
  const milestoneCheckins = new Collection({
    type: "base",
    name: "milestone_checkins",
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
      { type: "autodate", name: "completedAt", onCreate: true, onUpdate: false },
    ],
  });
  milestoneCheckins.addIndex("idx_checkin_unique", true, "milestone, user");
  app.save(milestoneCheckins);
}, (app) => {
  const c4 = app.findCollectionByNameOrId("milestone_checkins");
  if (c4) app.delete(c4);
  const c3 = app.findCollectionByNameOrId("schedule_milestones");
  if (c3) app.delete(c3);
  const c2 = app.findCollectionByNameOrId("group_schedules");
  if (c2) app.delete(c2);
  const c1 = app.findCollectionByNameOrId("user_media_progress");
  if (c1) app.delete(c1);
});

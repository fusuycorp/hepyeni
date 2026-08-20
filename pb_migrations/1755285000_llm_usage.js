/// <reference path="../pb_data/types.d.ts" />

// Fixed-slot reservations make LLM limits atomic across all Next replicas:
// concurrent requests compete on unique PocketBase record ids instead of
// reading and incrementing a shared counter.
migrate((app) => {
  if (app.findCollectionByNameOrId("llm_usage")) return;

  const users = app.findCollectionByNameOrId("users");
  const usage = new Collection({
    type: "base",
    name: "llm_usage",
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
      { type: "text", name: "window", required: true, max: 30 },
      {
        type: "select",
        name: "kind",
        required: true,
        maxSelect: 1,
        values: ["request", "input"],
      },
      { type: "text", name: "requestId", required: true, max: 15 },
      { type: "autodate", name: "createdAt", onCreate: true, onUpdate: false },
    ],
  });
  // ponytail: composite index (`window, user`) fails with "sql: no rows in
  // result set" on PocketBase 0.39.x when a relation field is in a multi-column
  // index (verified on a fresh DB) — write two single-column indexes instead;
  // atomicity comes from unique reservation ids, not this index. Upgrade path:
  // revisit composite-relation indexes on a PocketBase version where they apply.
  usage.addIndex("idx_llm_usage_window", false, "window");
  usage.addIndex("idx_llm_usage_user", false, "user");
  app.save(usage);
}, (app) => {
  const usage = app.findCollectionByNameOrId("llm_usage");
  if (usage) app.delete(usage);
});

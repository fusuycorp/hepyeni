// Fixed-slot reservations make LLM limits atomic across all Next replicas:
// concurrent requests compete on unique PocketBase record ids instead of
// reading and incrementing a shared counter.
migrate((app) => {
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
  // ponytail: llm_usage primary-key lookup <- PocketBase 0.39.11 throws sql: no rows in result set on explicit secondary indexes here -> add secondary index only if PocketBase JSVM index creation bug is resolved
  app.save(usage);
}, (app) => {
  const usage = app.findCollectionByNameOrId("llm_usage");
  if (usage) app.delete(usage);
});

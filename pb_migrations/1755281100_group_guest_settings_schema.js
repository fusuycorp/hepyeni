/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const groups = app.findCollectionByNameOrId("groups");
  if (!groups) return;

  const isPublicField = groups.fields.getByName("isPublic");
  if (!isPublicField) {
    groups.fields.add(
      new BoolField({
        name: "isPublic",
        required: false,
      }),
    );
  }

  const guestSettingsField = groups.fields.getByName("guestSettings");
  if (!guestSettingsField) {
    groups.fields.add(
      new JsonField({
        name: "guestSettings",
        required: false,
      }),
    );
  }

  app.save(groups);
}, (app) => {
  const groups = app.findCollectionByNameOrId("groups");
  if (!groups) return;

  if (groups.fields.getByName("isPublic")) {
    groups.fields.removeByName("isPublic");
  }
  if (groups.fields.getByName("guestSettings")) {
    groups.fields.removeByName("guestSettings");
  }
  app.save(groups);
});

/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const groups = app.findCollectionByNameOrId("groups");
  if (groups) {
    const isBlindPickEnabledField = groups.fields.getByName("isBlindPickEnabled");
    if (!isBlindPickEnabledField) {
      groups.fields.add(
        new BoolField({
          name: "isBlindPickEnabled",
          required: false,
        }),
      );
    }
    app.save(groups);
  }

  const userMediaProgress = app.findCollectionByNameOrId("user_media_progress");
  if (userMediaProgress) {
    const moodsField = userMediaProgress.fields.getByName("moods");
    if (!moodsField) {
      userMediaProgress.fields.add(
        new JSONField({
          name: "moods",
          required: false,
          maxSize: 2000000,
        }),
      );
    }

    const paceField = userMediaProgress.fields.getByName("pace");
    if (!paceField) {
      userMediaProgress.fields.add(
        new TextField({
          name: "pace",
          required: false,
          max: 100,
        }),
      );
    }
    app.save(userMediaProgress);
  }
}, (app) => {
  const groups = app.findCollectionByNameOrId("groups");
  if (groups) {
    if (groups.fields.getByName("isBlindPickEnabled")) {
      groups.fields.removeByName("isBlindPickEnabled");
    }
    app.save(groups);
  }

  const userMediaProgress = app.findCollectionByNameOrId("user_media_progress");
  if (userMediaProgress) {
    if (userMediaProgress.fields.getByName("moods")) {
      userMediaProgress.fields.removeByName("moods");
    }
    if (userMediaProgress.fields.getByName("pace")) {
      userMediaProgress.fields.removeByName("pace");
    }
    app.save(userMediaProgress);
  }
});

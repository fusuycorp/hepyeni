migrate((app) => {
  try {
    const titles = app.findRecordsByFilter("titles", "status = 'consumed'", "-createdAt", 500);
    const progressCollection = app.findCollectionByNameOrId("user_media_progress");

    for (const title of titles) {
      const reviews = app.findRecordsByFilter("reviews", `title = '${title.id}'`, "", 100);
      const userIds = new Set();
      for (const r of reviews) {
        const u = r.get("user");
        if (u) userIds.add(u);
      }
      const addedBy = title.get("addedBy");
      if (userIds.size === 0 && addedBy) {
        userIds.add(addedBy);
      }

      for (const uid of userIds) {
        const existing = app.findRecordsByFilter(
          "user_media_progress",
          `user = '${uid}' && groupTitle = '${title.id}'`,
          "",
          1,
        );
        if (existing.length === 0) {
          const record = new Record(progressCollection, {
            user: uid,
            groupTitle: title.id,
            mediaType: title.get("mediaType"),
            title: title.get("title"),
            creator: title.get("creator"),
            coverUrl: title.get("coverUrl"),
            externalSource: title.get("externalSource"),
            externalId: title.get("externalId"),
            status: "completed",
            startedAt: title.get("createdAt"),
            completedAt: title.get("consumedAt") || title.get("updated"),
            isSharedWithCircles: true,
          });
          app.save(record);
        }
      }
    }
  } catch {
    // Migration is robust to empty fresh databases
  }
}, (app) => {});

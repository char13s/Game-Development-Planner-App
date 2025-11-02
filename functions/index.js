
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

exports.archiveOldTasks = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const sevenDaysAgo = admin.firestore.Timestamp.fromMillis(now.toMillis() - 7 * 24 * 60 * 60 * 1000);

    // This function assumes a single-user structure. 
    // For a multi-user app, you would need to iterate through all users.
    const querySnapshot = await db.collectionGroup('tasks')
                                  .where('status', '==', 'done')
                                  .where('completedAt', '<=', sevenDaysAgo)
                                  .get();

    if (querySnapshot.empty) {
        console.log("No tasks to archive.");
        return null;
    }

    const batch = db.batch();
    querySnapshot.forEach(doc => {
        console.log(`Archiving task: ${doc.id}`);
        batch.update(doc.ref, { status: 'archived' });
    });

    await batch.commit();
    console.log(`Archived ${querySnapshot.size} tasks.`);
    return null;
});

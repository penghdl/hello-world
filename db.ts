import Dexie from "dexie";
import session from "./Session";

// Uses Dexie.js
// https://dexie.org/docs/API-Reference#quick-reference
const createDatabase = (username: string | null): Dexie => {
  const dbName: string = username ? `ntfy-${username}` : "ntfy"; // IndexedDB database is based on the logged-in user
  const db: Dexie = new Dexie(dbName);

  db.version(2).stores({
    subscriptions: "&id,baseUrl,[baseUrl+mutedUntil]",
    notifications: "&id,subscriptionId,time,new,[subscriptionId+new]", // compound key for query performance
    users: "&baseUrl,username",
    prefs: "&key",
  });

  return db;
};

export const dbAsync = async (): Promise<Dexie> => {
  const username: string | undefined = await session.usernameAsync();
  return createDatabase(username ?? null);
};

const db = (): Dexie => createDatabase(session.username() ?? null);

export default db;

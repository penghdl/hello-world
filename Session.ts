import Dexie from "dexie";

/**
 * Manages the logged-in user's session and access token.
 * The session replica is stored in IndexedDB so that the service worker can access it.
 */
class Session {
  db: Dexie;

  constructor() {
    this.db = new Dexie("session-replica");
    this.db.version(1).stores({
      kv: "&key",
    });

    // existing sessions (pre-v2.6.0) haven't called `store` with the session-replica,
    // so attempt to sync any values from localStorage to IndexedDB
    if (typeof localStorage !== "undefined" && this.exists()) {
      const username = this.username();
      const token = this.token();

      this.db.table('kv')
        .bulkPut([
          { key: "user", value: username },
          { key: "token", value: token },
        ])
        .then(() => {
          console.log("[Session] Synced localStorage session to IndexedDB", { username });
        })
        .catch((e: Error) => {
          console.error("[Session] Failed to sync localStorage session to IndexedDB", e);
        });
    }
  }

  async store(username: string, token: string): Promise<void> {
    await this.db.table("kv").bulkPut([
      { key: "user", value: username },
      { key: "token", value: token },
    ]);
    localStorage.setItem("user", username);
    localStorage.setItem("token", token);
  }

  async resetAndRedirect(url: string): Promise<void> {
    await this.db.delete();
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.href = url;
  }

  async usernameAsync(): Promise<string | undefined> {
    return (await this.db.table("kv").get({ key: "user" }))?.value;
  }

  exists(): boolean {
    return !!this.username() && !!this.token();
  }

  username(): string | null {
    return localStorage.getItem("user");
  }

  token(): string | null {
    return localStorage.getItem("token");
  }
}

const session = new Session();
export default session;

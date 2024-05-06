import Dexie from "dexie";
import db from "./db";

class SubscriptionManager {
  db: Dexie;

  constructor(dbImpl: Dexie) {
    this.db = dbImpl;
  }

  /** All subscriptions, including "new count"; this is a JOIN, see https://dexie.org/docs/API-Reference#joining */
  async all(): Promise<any[]> {
    const subscriptions = await this.db.table("subscriptions").toArray();
    return Promise.all(
      subscriptions.map(async (s) => ({
        ...s,
        new: await this.db.table("notifications").where({ subscriptionId: s.id, new: 1 }).count(),
      }))
    );
  }

  async get(subscriptionId: string): Promise<any> {
    return this.db.table("subscriptions").get(subscriptionId);
  }

  async add(baseUrl: string, topic: string, opts: { internal?: boolean } = {}): Promise<any> {
    const id: string = `${baseUrl}/${topic}`;
    const existingSubscription: any = await this.get(id);
    if (existingSubscription) {
      return existingSubscription;
    }

    const subscription: any = {
      ...opts,
      id: `${baseUrl}/${topic}`,
      baseUrl,
      topic,
      mutedUntil: 0,
      last: null,
    };

    await this.db.table("subscriptions").put(subscription);

    return subscription;
  }

  async syncFromRemote(remoteSubscriptions: any[], remoteReservations: any[]): Promise<void> {
    // console.log(`[SubscriptionManager] Syncing subscriptions from remote`, remoteSubscriptions);

    // // Add remote subscriptions
    // const remoteIds = await Promise.all(
    //   remoteSubscriptions.map(async (remote) => {
    //     const reservation = remoteReservations?.find((r) => remote.base_url === config.base_url && remote.topic === r.topic) || null;

    //     const local = await this.add(remote.base_url, remote.topic, {
    //       displayName: remote.display_name, // May be undefined
    //       reservation, // May be null!
    //     });

    //     return local.id;
    //   })
    // );

    // // Remove local subscriptions that do not exist remotely
    // const localSubscriptions = await this.db.table("subscriptions").toArray();

    // await Promise.all(
    //   localSubscriptions.map(async (local) => {
    //     const remoteExists = remoteIds.includes(local.id);
    //     if (!local.internal && !remoteExists) {
    //       await this.remove(local);
    //     }
    //   })
    // );
  }

  async updateState(subscriptionId: string, state: any): Promise<void> {
    this.db.table("subscriptions").update(subscriptionId, { state });
  }

  async remove(subscription: any): Promise<void> {
    await this.db.table("subscriptions").delete(subscription.id);
    await this.db.table("notifications").where({ subscriptionId: subscription.id }).delete();
  }

  async first(): Promise<any | undefined> {
    return this.db.table("subscriptions").toCollection().first(); // May be undefined
  }

  async getNotifications(subscriptionId: string): Promise<any[]> {
    // This is quite awkward, but it is the recommended approach as per the Dexie docs.
    // It's actually fine, because the reading and filtering is quite fast. The rendering is what's
    // killing performance. See  https://dexie.org/docs/Collection/Collection.offset()#a-better-paging-approach

    return this.db.table("notifications")
      .orderBy("time") // Sort by time first
      .filter((n: any) => n.subscriptionId === subscriptionId)
      .reverse()
      .toArray();
  }

  async getAllNotifications(): Promise<any[]> {
    return this.db.table("notifications")
      .orderBy("time") // Efficient, see docs
      .reverse()
      .toArray();
  }

  /** Adds notification, or returns false if it already exists */
  async addNotification(subscriptionId: string, notification: any): Promise<boolean> {
    const exists = await this.db.table("notifications").get(notification.id);
    if (exists) {
      return false;
    }
    try {
      // sw.js duplicates this logic, so if you change it here, change it there too
      await this.db.table("notifications").add({
        ...notification,
        subscriptionId,
        // New marker (used for bubble indicator); cannot be boolean; Dexie index limitation
        new: 1,
      }); // FIXME consider put() for double tab
      await this.db.table("notifications").update(subscriptionId, {
        last: notification.id,
      });
    } catch (e) {
      console.error(`[SubscriptionManager] Error adding notification`, e);
    }
    return true;
  }

  /** Adds/replaces notifications, will not throw if they exist */
  async addNotifications(subscriptionId: string, notifications: any[]): Promise<void> {
    const notificationsWithSubscriptionId = notifications.map((notification) => ({ ...notification, subscriptionId }));
    const lastNotificationId = notifications.at(-1).id;
    await this.db.table("notifications").bulkPut(notificationsWithSubscriptionId);
    await this.db.table("notifications").update(subscriptionId, {
      last: lastNotificationId,
    });
  }

  async updateNotification(notification: any): Promise<boolean> {
    const exists = await this.db.table("notifications").get(notification.id);
    if (!exists) {
      return false;
    }
    try {
      await this.db.table("notifications").put({ ...notification });
    } catch (e) {
      console.error(`[SubscriptionManager] Error updating notification`, e);
    }
    return true;
  }

  async deleteNotification(notificationId: string): Promise<void> {
    await this.db.table("notifications").delete(notificationId);
  }

  async deleteNotifications(subscriptionId: string): Promise<void> {
    await this.db.table("notifications").where({ subscriptionId }).delete();
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    await this.db.table("notifications").where({ id: notificationId }).modify({ new: 0 });
  }

  async markNotificationsRead(subscriptionId: string): Promise<void> {
    await this.db.table("notifications").where({ subscriptionId, new: 1 }).modify({ new: 0 });
  }

  async setMutedUntil(subscriptionId: string, mutedUntil: number): Promise<void> {
    await this.db.table("subscriptions").update(subscriptionId, {
      mutedUntil,
    });
  }

  async setDisplayName(subscriptionId: string, displayName: string): Promise<void> {
    await this.db.table("subscriptions").update(subscriptionId, {
      displayName,
    });
  }

  async setReservation(subscriptionId: string, reservation: any): Promise<void> {
    await this.db.table("subscriptions").update(subscriptionId, {
      reservation,
    });
  }

  async update(subscriptionId: string, params: any): Promise<void> {
    await this.db.table("subscriptions").update(subscriptionId, params);
  }

  async pruneNotifications(thresholdTimestamp: number): Promise<void> {
    await this.db.table("notifications").where("time").below(thresholdTimestamp).delete();
  }

  async isNotificationUnread(notificationId: string): Promise<boolean> {
    const notification = await this.db.table("notifications").get(notificationId);
    return notification ? notification.new === 1 : true;
  }
  async isNotificationExist(notificationId: string): Promise<boolean> {
    try {
      const notification = await this.db.table("notifications").get(notificationId);
      return !!notification;
    } catch (error) {
      console.error("Error checking if notification exists:", error);
      return false;
    }
  }
}

export default new SubscriptionManager(db());

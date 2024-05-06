import React, { useState, useEffect } from 'react';
import {
  Button,
  NotificationDrawer,
  NotificationDrawerBody,
  NotificationDrawerHeader,
  NotificationDrawerList,
  NotificationDrawerListItem,
  NotificationDrawerListItemBody,
  NotificationDrawerListItemHeader,
} from '@patternfly/react-core';
import SubscriptionManager from "./ntfy/SubscriptionManager";

interface Props {
  isUnreadMap: { [notificationId: string]: boolean };
  notifications: any[];
  setIsUnreadMap: React.Dispatch<React.SetStateAction<{ [notificationId: string]: boolean }>>;
}

const NotificationDrawerBasic: React.FunctionComponent<Props> = ({ isUnreadMap, notifications, setIsUnreadMap }) => {
  const drawerRef = React.useRef<HTMLElement | null>(null);

  const onListItemClick = (id: string) => {
    if (!isUnreadMap || !isUnreadMap[id]) {
      return;
    }
    
    setIsUnreadMap((prevIsUnreadMap) => ({ ...prevIsUnreadMap, [id]: false }));
    SubscriptionManager.markNotificationRead(id);
  };

  const markAllRead = () => {
    if (!isUnreadMap) {
      return;
    }

    setIsUnreadMap((prevIsUnreadMap) => {
      Object.keys(prevIsUnreadMap).forEach(async (key) => {
        await SubscriptionManager.markNotificationRead(key);
      });

      return Object.fromEntries(
        Object.keys(prevIsUnreadMap).map((key) => [key, false])
      );
    });
  }

  const getNumberUnread: () => number = () => {
    if (!isUnreadMap) {
      return 0;
    }
    return Object.values(isUnreadMap).reduce((count, value) => count + (value ? 1 : 0), 0);
  };

  return (
    <NotificationDrawer ref={drawerRef}>
      <NotificationDrawerHeader count={getNumberUnread()}>
        <Button variant="secondary" sizes="sm" onClick={() => markAllRead()}>
          Mark all read
        </Button>
      </NotificationDrawerHeader>
      <NotificationDrawerBody>
        <NotificationDrawerList>
          {notifications.map((notification) => (
            <NotificationDrawerListItem
              key={notification.id}
              variant="info"
              onClick={() => onListItemClick(notification.id)}
              isRead={isUnreadMap === null || !isUnreadMap[notification.id]}
            >
              <NotificationDrawerListItemHeader
                key={`header_${notification.id}`}
                variant="info"
                title={notification.title}
                srTitle={`${notification.title} notification:`}
              >
              </NotificationDrawerListItemHeader>
              <NotificationDrawerListItemBody
                key={`body_${notification.id}`}
                timestamp={`${Math.floor((Date.now() - notification.time * 1000) / 60000)} minutes ago`}
              >
                {notification.message}
              </NotificationDrawerListItemBody>
            </NotificationDrawerListItem>
          ))}
        </NotificationDrawerList>
      </NotificationDrawerBody>
    </NotificationDrawer>
  );
};

export default NotificationDrawerBasic;

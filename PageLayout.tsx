/*
 * Copyright 2021 Red Hat, Inc. and/or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { useState, useEffect } from 'react';
import {
  Page,
  PageSidebar,
  PageHeader,
  PageHeaderTools
} from '@patternfly/react-core/dist/js/components/Page';
import { Brand } from '@patternfly/react-core/dist/js/components/Brand';
import '../../styles.css';

import {
  componentOuiaProps,
  ouiaAttribute,
  OUIAProps
} from '@kogito-apps/ouia-tools/dist/utils/OuiaUtils';
import { BrandContext } from '../BrandContext/BrandContext';
import PageToolbar from '../PageToolbar/PageToolbar';
import NotificationDrawerBasic from '../NotificationDrawerBasic/NotificationDrawerBasic';
import axios from 'axios';
import SubscriptionManager from "../NotificationDrawerBasic/ntfy/SubscriptionManager";

interface IOwnProps {
  children: React.ReactNode;
  BrandSrc?: string;
  PageNav: React.ReactNode;
  pageNavOpen?: boolean;
  BrandAltText?: string;
  withHeader: boolean;
  BrandClick?: () => void;
}

const PageLayout: React.FC<IOwnProps & OUIAProps> = ({
  children,
  BrandSrc,
  PageNav,
  pageNavOpen,
  withHeader,
  BrandAltText,
  BrandClick,
  ouiaId,
  ouiaSafe
}) => {
  const pageId = 'main-content-page-layout-default-nav';

  const [isNavOpen, setIsNavOpen] = useState(
    pageNavOpen != undefined ? pageNavOpen : true
  );
  const onNavToggle = () => {
    setIsNavOpen(!isNavOpen);
  };

  useEffect(() => {
    if (document.getElementById(pageId)) {
      document.getElementById(pageId).setAttribute('data-ouia-main', 'true');
    }
  });

  const [isUnreadMap, setIsUnreadMap] = useState<{ [notificationId: string]: boolean } | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isDrawerExpanded, setIsDrawerExpanded] = React.useState(true);
  
  const userId = 'hp003';
  const base_url = 'https://ntfy.sh';

  const onUnreadClick = () => {
    setIsDrawerExpanded(!isDrawerExpanded);
  };

  const getNumberUnread: () => number = () => {
    if (!isUnreadMap) {
      return 0;
    }
    return Object.values(isUnreadMap).reduce((count, value) => count + (value ? 1 : 0), 0);
  };

  const Header = (
    <PageHeader
      logo={<Brand src={BrandSrc} alt={BrandAltText} onClick={BrandClick} />}
      headerTools={
        <PageHeaderTools>
          <BrandContext.Provider
            value={{
              imageSrc: BrandSrc,
              altText: BrandAltText
            }}
          >
            <PageToolbar 
              onUnreadClick={onUnreadClick}
              unreadCount={getNumberUnread()}
            />
          </BrandContext.Provider>
        </PageHeaderTools>
      }
      showNavToggle
      isNavOpen={isNavOpen}
      onNavToggle={onNavToggle}
      {...ouiaAttribute('data-ouia-header', 'true')}
    />
  );

  const Sidebar = (
    <PageSidebar
      nav={PageNav}
      isNavOpen={isNavOpen}
      theme="dark"
      {...ouiaAttribute('data-ouia-navigation', 'true')}
      data-testid="page-sidebar"
    />
  );

  const Notification =(
    <NotificationDrawerBasic
      isUnreadMap={isUnreadMap}
      notifications={notifications}
      setIsUnreadMap={setIsUnreadMap}
    />
  );

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const localNotifications = await SubscriptionManager.getNotifications(userId);
  
        let url = base_url + '/' + userId + '/json?poll=1';
        if (localNotifications.length > 0) {
          const latestNotificationId = localNotifications[0].id;
          url = `${base_url}/${userId}/json?since=${latestNotificationId}&poll=1`;
        }
  
        const response = await axios.get(url);
  
        if (typeof response.data === 'object') {
          handleObjectResponse(response.data, localNotifications);
        } else if (typeof response.data === 'string') {
          handleStringResponse(response.data, localNotifications);
        }
  
      } catch (error) {
        console.error('Fail to get notification:', error);
      }
    };
  
    const handleObjectResponse = (data, localNotifications) => {
      try {
        const notificationWithKey = {
          ...data,
          key: data.id,
        };
        localNotifications.unshift(notificationWithKey);
        updateNotifications(localNotifications);
        SubscriptionManager.addNotification(userId, data);
      } catch (error) {
        console.error('处理对象响应时出错:', error);
      }
    };
  
    const handleStringResponse = async (data, localNotifications) => {
      const trimmedData = data.trim();
      if (trimmedData === "") {
        updateNotifications(localNotifications);
        return;
      }
  
      const jsonStrings = trimmedData.split('\n');
      const reversedNewNotifications = jsonStrings.map(jsonString => JSON.parse(jsonString)).reverse();
  
      if (Array.isArray(reversedNewNotifications)) {
        const newNotificationsWithKeys = reversedNewNotifications.map((notification) => ({
          ...notification,
          key: notification.id,
          new: 1
        }));
  
        for (const notification of newNotificationsWithKeys) {
          try {
            const notificationExists = await SubscriptionManager.isNotificationExist(notification.id);
            if (!notificationExists) {
              await SubscriptionManager.addNotification(userId, notification);
            }
          } catch (error) {
            console.error("Error updating notification:", error);
          }
        }
  
        localNotifications.unshift(...newNotificationsWithKeys);
        updateNotifications(localNotifications);
      } else {
        console.error('Parsed data is not array:', reversedNewNotifications);
      }
    };
  
    const updateNotifications = async (notifications) => {
      setNotifications(notifications);
      const initialUnreadMapPromise = Promise.all(notifications.map(async (notification) => {
        try {
          const isRead = await SubscriptionManager.isNotificationUnread(notification.id);
          return { id: notification.id, unread: isRead };
        } catch (error) {
          console.error("Error checking if notification is read:", error);
          return { id: notification.id, unread: true }; 
        }
      }));
  
      initialUnreadMapPromise.then((results) => {
        const initialUnreadMap = results.reduce((acc, { id, unread }) => {
          acc[id] = unread;
          return acc;
        }, {});
        setIsUnreadMap(initialUnreadMap);
      }).catch((error) => {
        console.error("Error getting initial unread map:", error);
      });
    };
  
    fetchNotifications();
  }, []);

  useEffect(() => {
    const sseUrl = base_url + '/' + userId + '/sse';
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      const newNotification = JSON.parse(event.data);
      setNotifications((prevNotifications) => [newNotification, ...prevNotifications]);
      SubscriptionManager.addNotification(userId, newNotification);
      if (!isUnreadMap) {
        setIsUnreadMap({ [newNotification.id]: true });
      } else if (!isUnreadMap[newNotification.id]) {
        setIsUnreadMap((prevIsUnreadMap) => ({ ...prevIsUnreadMap, [newNotification.id]: true }));
      }
    };

    eventSource.onerror = (error) => {
      console.error('EventSource failed:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [isUnreadMap]);

  return (
    <React.Fragment>
      <Page
        header={withHeader ? Header : <></>}
        mainContainerId={pageId}
        sidebar={Sidebar}
        notificationDrawer={Notification}
        isNotificationDrawerExpanded={isDrawerExpanded}
        className="kogito-consoles-common--PageLayout"
        {...componentOuiaProps(ouiaId, 'page', ouiaSafe)}
      >
        {children}
      </Page>
    </React.Fragment>
  );
};

export default PageLayout;

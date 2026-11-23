import { translate } from '@1minitman/i18n';
import { fontSizes, size } from '@1minitman/tokens';
import { useThemeColor } from '@1minitman/ui-native';
import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Feather>['name'];

// The five tabs, in the order the product defines: My Specs · Likes · Chats · Groups · Profile.
const TABS = [
  { name: 'specs', title: translate('en', 'tabs.specs'), icon: 'layers', testID: 'tabs.specs' },
  { name: 'likes', title: translate('en', 'tabs.likes'), icon: 'heart', testID: 'tabs.likes' },
  {
    name: 'chats',
    title: translate('en', 'tabs.chats'),
    icon: 'message-circle',
    testID: 'tabs.chats',
  },
  { name: 'groups', title: translate('en', 'tabs.groups'), icon: 'users', testID: 'tabs.groups' },
  { name: 'me', title: translate('en', 'tabs.profile'), icon: 'user', testID: 'tabs.profile' },
] satisfies { name: string; title: string; icon: IconName; testID: string }[];

export default function TabsLayout() {
  const fg = useThemeColor('fg');
  const fg3 = useThemeColor('fg-3');
  const bg = useThemeColor('bg');
  const border = useThemeColor('border');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: fg,
        tabBarInactiveTintColor: fg3,
        tabBarStyle: { backgroundColor: bg, borderTopColor: border },
        tabBarLabelStyle: { fontFamily: 'Manrope_600SemiBold', fontSize: fontSizes[0] },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarButtonTestID: tab.testID,
            tabBarIcon: ({ focused }) => (
              <Feather name={tab.icon} size={size.icon} color={focused ? fg : fg3} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

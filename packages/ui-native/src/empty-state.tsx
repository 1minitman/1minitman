import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from './text';

export interface EmptyStateProps {
  title: string;
  /** One supporting line, about 15 words at most. */
  message?: string;
  /** Usually one Button. */
  action?: ReactNode;
  testID?: string;
}

/** The single empty state used by every list (design note: shared <EmptyState>). */
export const EmptyState = ({ title, message, action, testID }: EmptyStateProps) => (
  <View testID={testID} className="flex-1 items-center justify-center gap-3 px-6">
    <Text variant="h2" className="text-center">
      {title}
    </Text>
    {message ? (
      <Text muted className="text-center">
        {message}
      </Text>
    ) : null}
    {action ? <View className="mt-3 self-stretch">{action}</View> : null}
  </View>
);

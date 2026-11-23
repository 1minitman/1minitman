import { Button, Text } from '@1minitman/ui-native';
import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { healthQuery } from '@/lib/api';
import { env } from '@/lib/env';
import { useHaptic } from '@/lib/haptics';

// D1 My Specs. For now it proves the chain: app -> typed client -> API.
export default function SpecsScreen() {
  const health = useQuery(healthQuery);
  const tap = useHaptic('selection');

  const status = health.isPending
    ? 'Checking the service…'
    : health.isError
      ? `Can't reach the service at ${env.apiUrl}`
      : `Connected · ${health.data.environment} · v${health.data.version}`;

  return (
    <SafeAreaView className="flex-1 bg-bg" testID="screen.D1">
      <View className="flex-1 justify-center gap-4 px-4">
        <Text variant="label" muted>
          Don't waste my time.
        </Text>
        <Text variant="h1">My Specs</Text>
        <Text muted testID="specs.status.api">
          {status}
        </Text>
        <Button
          label="Try again"
          variant="secondary"
          testID="specs.status.retry"
          onPress={() => {
            tap();
            void health.refetch();
          }}
        />
      </View>
    </SafeAreaView>
  );
}

import { EmptyState } from '@1minitman/ui-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Stands in for a tab until its flow is built. `screen` is the design's screen code. */
export const TabPlaceholder = ({ title, screen }: { title: string; screen: string }) => (
  <SafeAreaView className="flex-1 bg-bg" testID={`screen.${screen}`}>
    <EmptyState title={title} message={`Screen ${screen} is not built yet.`} />
  </SafeAreaView>
);

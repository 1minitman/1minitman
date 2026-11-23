import { Redirect } from 'expo-router';

// A0 (splash / entry). When auth exists this decides between the welcome flow (A1),
// onboarding resume and the signed-in home. Until then it opens the tabs.
export default function Entry() {
  return <Redirect href="/specs" />;
}

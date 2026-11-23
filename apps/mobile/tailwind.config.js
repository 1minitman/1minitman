/** @type {import('tailwindcss').Config} */
module.exports = {
  // Class names are read from this app and from the shared native components.
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui-native/src/**/*.{ts,tsx}'],
  // Colours, radius, spacing and type sizes come from tokens.json. Add nothing by hand.
  presets: [require('nativewind/preset'), require('@1minitman/tokens/tailwind-preset')],
  theme: {
    extend: {
      // On native every weight is its own font family (loaded in src/providers/fonts.ts).
      fontFamily: {
        body: ['Manrope_500Medium'],
        caption: ['Manrope_600SemiBold'],
        title: ['Manrope_700Bold'],
        display: ['Manrope_800ExtraBold'],
      },
    },
  },
};

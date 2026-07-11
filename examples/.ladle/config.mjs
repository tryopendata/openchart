/** @type {import('@ladle/react').UserConfig} */
export default {
  port: 6006,
  stories: 'src/**/*.stories.{tsx,ts}',
  viteConfig: 'vite.config.ts',
  // defaultStory added in Phase 05 when the Welcome story exists.
  addons: {
    theme: { enabled: true, defaultState: 'auto' },
    width: {
      enabled: true,
      defaultState: 0,
      options: { phone: 390, tablet: 744, laptop: 1024 },
    },
    source: { enabled: false },
    rtl: { enabled: false },
    msw: { enabled: false },
  },
  storyOrder: () => [
    'welcome*',
    'charts*',
    'tables*',
    'graphs*',
    'sankey*',
    'dashboards*',
    'features*',
    'showcase*',
    'playground*',
    'testing*',
    '*', // catch-all: never remove during migration; unmatched stories would vanish
  ],
};

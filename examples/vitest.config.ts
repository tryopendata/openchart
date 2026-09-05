import { defineConfig } from 'vitest/config';

/**
 * The gallery ships one unit test: the six named house styles are a design
 * contract (six entries, AA text on their own surface, a 3:1 lead hue), and
 * nothing else in the repo would catch a regression in `.ladle/themes.ts`.
 */
export default defineConfig({
  test: {
    name: 'examples',
    environment: 'node',
    include: ['src/**/*.test.ts', '.ladle/**/*.test.ts'],
  },
});

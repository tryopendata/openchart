/**
 * Programming language popularity index, % share, 2025.
 *
 * Editorial data carried over from the existing story files with its original
 * citation (TIOBE Index). Used for the ranked BarList demo.
 */
export const programmingLanguages = {
  source: 'Source: TIOBE Index',
  url: 'https://www.tiobe.com/tiobe-index/',
  data: [
    { language: 'Python', pct: 23.4, category: 'general' },
    { language: 'Java', pct: 17.1, category: 'general' },
    { language: 'JavaScript', pct: 14.9, category: 'web' },
    { language: 'C/C++', pct: 11.2, category: 'systems' },
    { language: 'C#', pct: 8.6, category: 'general' },
    { language: 'Go', pct: 5.8, category: 'systems' },
    { language: 'TypeScript', pct: 5.3, category: 'web' },
    { language: 'Rust', pct: 4.1, category: 'systems' },
    { language: 'PHP', pct: 3.7, category: 'web' },
    { language: 'Swift', pct: 2.6, category: 'mobile' },
    { language: 'Kotlin', pct: 2.1, category: 'mobile' },
    { language: 'Ruby', pct: 1.2, category: 'web' },
  ],
} as const;

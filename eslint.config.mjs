import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier/flat';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['app/**/*.tsx', 'components/**/*.tsx'],
    rules: {
      ...jsxA11y.configs.recommended.rules,
      'jsx-a11y/alt-text': ['error', { elements: ['img'], img: ['Image'] }],
      'jsx-a11y/anchor-is-valid': [
        'error',
        { components: ['Link'], specialLink: ['href'], aspects: ['invalidHref', 'preferButton'] },
      ],
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-key': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
  {
    files: ['components/**/*.{ts,tsx}', 'config/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/*', '@/app/**'],
              message:
                'Shared UI/config must not import route implementations. Move reusable code to components, lib, or config.',
            },
          ],
        },
      ],
    },
  },
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    '.next-*/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    '.codex-*/**',
    'outputs/**',
    'coverage/**',
  ]),
]);

export default eslintConfig;

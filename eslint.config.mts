import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier/recommended';
import moleculer from '@treatwell/eslint-plugin-moleculer';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
  { ignores: ['dist/', '.pnp.*', '.yarn'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  prettier,
  moleculer.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    extends: [
      importPlugin.flatConfigs.recommended,
      importPlugin.flatConfigs.typescript,
    ],
    // See https://github.com/import-js/eslint-plugin-import/issues/3170
    settings: {
      'import/resolver': { typescript: true },
    },
    rules: {
      'import/no-named-as-default-member': 'off',
    },
  },
);

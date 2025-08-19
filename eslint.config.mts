import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier/recommended';
import moleculer from '@treatwell/eslint-plugin-moleculer';

export default tseslint.config(
  { ignores: ['dist/', '.pnp.*', '.yarn'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  prettier,
  moleculer.configs.recommended,
);

import js from '@eslint/js'
import tslint from 'typescript-eslint'
import eslintPluginAstro from 'eslint-plugin-astro'

export default [
  js.configs.recommended,
  ...tslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  {
    rules: {},
  },
]

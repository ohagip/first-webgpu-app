export default {
  plugins: ['prettier-plugin-astro'],
  overrides: [
    {
      files: '*.astro',
      options: {
        parser: 'astro',
      },
    },
  ],
  semi: false,
  singleQuote: true,
  tabWidth: 2,
  printWidth: 120,
}

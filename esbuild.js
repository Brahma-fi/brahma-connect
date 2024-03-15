const esbuild = require('esbuild')
const cssModulesPlugin = require('esbuild-css-modules-plugin')
const plugin = require('node-stdlib-browser/helpers/esbuild/plugin')
const stdLibBrowser = require('node-stdlib-browser')

require('dotenv').config()

esbuild
  .build({
    entryPoints: [
      './src/background.ts',
      './src/contentScript.ts',
      './src/introduce.ts',
      './src/launch.ts',
      './src/injection.ts',
      './src/app.tsx',
    ],
    bundle: true,
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV !== 'production' ? 'inline' : 'linked',
    loader: {
      '.svg': 'file',
      '.woff': 'file',
      '.woff2': 'file',
      '.png': 'file',
    },
    target: ['chrome96'],
    outdir: './public/build',
    publicPath: '/build',
    inject: [require.resolve('node-stdlib-browser/helpers/esbuild/shim')],
    define: {
      'process.env.NODE_ENV': `"${process.env.NODE_ENV}"`,
      global: 'window',
    },
    plugins: [plugin(stdLibBrowser), cssModulesPlugin()],
    watch: process.env.NODE_ENV === 'development' && {
      onRebuild() {
        console.log('Rebuild successful.')
      },
    },
    logLevel: process.env.NODE_ENV === 'development' ? 'verbose' : 'error',
  })
  .then(() => console.log('Build successful.'))
  .catch(() => process.exit(1))

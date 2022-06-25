# About

Deadcode elimination via running end-to-end tests.

Sample project: [DCE for threejs](https://github.com/ycw/e2edce-sample-project)



# Install

`npm i -D ycw/e2edce`



# Usage

First, create a [configuration file](#configuration-file) in project root

Then, config package.json

```json
{ 
  "scripts": {
    "build": "e2edce e2edce.config.js"
  }
}
```

Finally, run `npm run build` to build artifacts

- index.build.js (min)
- index.build.js.gz (min + gzipped)



# Configuration File

`e2edce.config.js`

```js
export default {
  // --- required ---
  configs: [ // array of configs
    {
      // --- required ---
      input: 'src/index.js', // path to entry
      output: 'index.build.js', // path to output file
      test: 'e2e/test.js', // path to test file 
      // --- optional ---
      compress: true, 
      mangle: true,
      beautify: false, // with indentation?
      debug: false, // create a debug build?
      port: 8081, // dev server port
      headless: true, // run tests in headless browser?
      visitor: undefined, // transform sources 
    }
  ],
  // --- optional ---
  setup: async() => {}, // run once before processing
  teardown: async() => {}, // run once after processing
  resolve: async() => {}, // custom module resolution
}
```

- `compress` is https://github.com/terser/terser#compress-options

- `mangle` is https://github.com/terser/terser#mangle-options

- `beautify` is the opposite of 'minified' in https://babeljs.io/docs/en/babel-generator

- `debug` if true, uncoverage fns will `throw` at runtime instead of removal at
  compile time; `compress`, `mangle` and `beautify` will be overrided.

- `resolve` is https://rollupjs.org/guide/en/#resolveid

  We could generate temporary modules(in `setup`) for module replacement(in `resolve`)
  and remove those modules(in `teardown`) after processing all builds.

- `visitor` is a [babel visitor](https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md#visitors)

  This will transform original sources during flattening. 



## Test File 

`e2e/test.js`

Export a async fn or an object

```js
export default async (page) => { // e2e test
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle' })
}
```

```js
export default {
  // --- required ---
  test: async () => { // e2e test
    await page.goto('http://localhost:8081', { waitUntil: 'networkidle' })
  },
  // --- optional ---
  inject: () => {}
}
```

- `page` is a https://playwright.dev/docs/api/class-page

- `inject`, a fn to be injected at the end of **input module**

   We could add mocks inside `inject()` to directly cover certain code branches 
   instead of writing complex e2e tests inside `test()`
  

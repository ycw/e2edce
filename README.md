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
  input: 'src/index.js', // path to entry
  output: 'index.build.js', // path to output file
  test: 'e2e/test.js', // path to test file 

  // --- optional ---
  compress: true, // compress? (bool | object)
  mangle: true, // mangle? (bool | object)
  minify: true, // trim whitespaces?
  port: 8081, // dev server port
  headless: true, // run tests in headless browser?
  debug: false // build artifacts for dbg?
}
```

- `compress` is https://github.com/terser/terser#compress-options
- `mangle` is https://github.com/terser/terser#mangle-options
- `debug` if true, creates extra artifacts alongside output file


## Test File 

`e2e/test.js`

Export a async fn or an object

```js
export default async (page) => {
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle' })
  // ...
}
```

```js
export default {
  test: async () => { // required
    await page.goto('http://localhost:8081', { waitUntil: 'networkidle' })
    // ...
  },
  inject: () => {..} // optional
}
```

- `page` is a https://playwright.dev/docs/api/class-page
- `inject`, a fn to be run at the end of input module, `src/index.js`,

   We could add mocks inside `inject()` to directly cover certain code branches 
   instead of writing complex e2e tests inside `test()`
  

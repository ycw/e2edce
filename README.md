# About

Deadcode elimination via running end-to-end tests.

ex. [DCE a threejs app](https://github.com/ycw/e2edce-sample-project)



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

Finally, run `npm run build` to build

- index.build.js (min)
- index.build.js.gz (min + gzipped)



# Configuration File

Configuration file sample 

`e2edce.config.js`

```js
export default {
  // --- required ---
  input: 'src/index.js', // entry
  output: 'index.build.js', // output
  test: 'e2e/test.js', // test file

  // --- optional ---
  compress: true, // compress? (bool | object)
  mangle: true, // mangle symbol? (bool | object)
  minify: true, // trim whitespaces?
  headless: true, // test headlessly?
  port: 8081, // dev server port
  debug: false // (this flag is yet impl)
}
```

- `compress` is https://github.com/terser/terser#compress-options
- `mangle` is https://github.com/terser/terser#mangle-options


---
E2e test file sample

`e2e/test.js`

```js
export default async (page) => {
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle' })
}
```

- `page` is a https://playwright.dev/docs/api/class-page
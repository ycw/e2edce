# About
Deadcode elimination via running end-to-end tests.



# Install

`npm i -D ycw/e2edce`



# Usage

First, create a [configuration file](#configuration-file)

Then, config your project's package.json

```json
{ 
  "scripts": {
    "build": "e2edce e2edce.config.js"
  }
}
```

Finally, run `npm run build`

This will output two files:

   1. index.build.js (min)
   2. index.build.js.gz (gzip)

And, a report will print to stdout. 


# Configuration File

e2edce.config.js

```js
export default {

  // [REQUIRED] Input/output file; relative to cwd
  input: 'src/index.js',
  output: 'index.build.js',

  // Transformation
  compress: true, 
  mangle: true,
  minified: true, // trim wsp or not

  // What kind of fn to be elim.?
  elim_uncov_class_method: false,
  elim_uncov_prop_method: true,
  elim_uncov_prop_fn_expr: true,
  
  // Debug? yes -> inserts `console.error()` in uncov fns' body  
  dbg_mode: false,

  // Dev server port
  port: 8080,

  // Are e2e tests running in a headless browser
  headless: true,

  // [REQUIRED] coverage  
  async cov(page) {
    // page = https://playwright.dev/docs/api/class-page
    await page.goto(
      'http://localhost:8080/', 
      { waitUntil: 'networkidle' }
    )

    // ... add other actions here ...
  },
}
```


#!/usr/bin/env node

import fs, { createReadStream, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'
import zlib from 'node:zlib'
import path from 'node:path'
import { rollup } from 'rollup'
import { terser } from 'rollup-plugin-terser'
import nodeResolve from '@rollup/plugin-node-resolve'
import { chromium } from 'playwright'
import parser from '@babel/parser'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import * as t from '@babel/types'
import { startDevServer } from '@web/dev-server'

const traverse = _traverse.default
const generate = _generate.default





// ---
// config
// ---

if (!process.argv[2]) {
  console.error('err: missing config file')
  console.error('example usage: node e2edce myconfig.js')
  process.exit(-1)
}

const url = 'file:///' + path.join(process.cwd(), process.argv[2])
const _config = (await import(url)).default

if (!_config.input) {
  console.error('err: .input field is missing in config file')
  process.exit(-1)
}

if (!_config.output) {
  console.error('err: .output field is missing in config file')
  process.exit(-1)
}

if (!_config.cov) {
  console.error('err: .cov field is missing in config file')
  process.exit(-1)
}

const config = Object.assign({
  input: undefined,
  output: undefined,
  dbg_mode: false,
  compress: true,
  mangle: true,
  minified: true,
  elim_uncov_class_method: false,
  elim_uncov_prop_method: true,
  elim_uncov_prop_fn_expr: true,
  headless: true,
  port: 8080,
  cov: undefined
}, _config)





// ---
// main
// ---

let code
let size_rollup
let size_dce





// ---
// Pass 0
// ---

console.log()
console.group('Boots a dev server')
console.log({ port: config.port })

const server = await startDevServer({
  logStartMessage: false,
  config: {
    port: config.port,
    rootDir: process.cwd()
  }
})

console.groupEnd()





// ---
// Pass 1
// ---

console.log()
console.group('Rollup, removes comments')

code = await (async () => {
  const bundle = await rollup({
    input: config.input,
    plugins: [nodeResolve(), terser({
      toplevel: true,
      compress: false,
      mangle: false,
      format: {
        comments: false, // must
        beautify: false
      }
    })]
  }).catch((e) => {
    console.error('err: failed to rollup')
    console.error(e)
    process.exit(-1)
  })

  const { output } = await bundle.generate({})
  await bundle.close()

  size_rollup = output[0].code.length

  return output[0].code
})()

// write file (required)

fs.writeFileSync(config.output, code)

console.groupEnd()



// ---
// Pass 2
// ---

console.log()
console.group('Replaces uncov fns/methods body')
console.log({
  dbg_mode: config.dbg_mode,
  headless: config.headless
})


code = await (async () => {

  if (!config.cov) {
    return code
  }

  const browser = await chromium.launch({ headless: config.headless })
  const page = await browser.newPage()
  await page.coverage.startJSCoverage({ resetOnNavigation: false })

  try {
    await config.cov(page)
  } catch (e) {
    console.error('err: caught err from user-provided cov()')
    console.error(e)
    process.exit(-1)
  }

  const coverage = await page.coverage.stopJSCoverage()
  console.log('Closes browser')
  await browser.close()
  console.log('Stops dev server')
  await server.stop()

  if (coverage.length === 0) {
    return code
  }

  const entry = coverage[0]
  const uncov = entry.functions
    .filter(f => !f.isBlockCoverage && f.functionName.length)

  const org = entry.source
  let at = 0
  let nu = ''

  for (const { functionName, ranges } of uncov) {
    for (const { startOffset, endOffset } of ranges) {

      // append covered 

      nu += org.substring(at, startOffset)
      at = endOffset

      // handle uncovered

      const fn_str = org.substring(startOffset, endOffset)
      const fname = functionName.indexOf('.') > -1
        ? ''
        : functionName

      const fn_body = config.dbg_mode
        ? `console.error("fn body is removed");`
        : ''

      if (fn_str.startsWith('function')) {
        nu += `function ${fname}(){${fn_body}}`
      } else if (fn_str.startsWith('async function')) {
        nu += `async function ${fname}(){${fn_body}}`
      } else if (fn_str.startsWith('constructor')) { // class ctor
        nu += `constructor(){${fn_body}}`
      } else if (fn_str.startsWith('set ')) { // setter
        nu += `${fname}(v){${fn_body}}`
      } else if (fn_str.startsWith('(')) { // arrow fn
        nu += `()=>{${fn_body}}`
      } else {
        nu += `${fname}(){${fn_body}}`
      }
    }
  }

  // append last
  nu += org.substring(at)

  return nu
})()

// (debug only)
// fs.writeFileSync('index.build_dbg.js', code)

size_dce = code.length

console.groupEnd()





// ---
// Pass 3
// ---

console.log()
console.group('Eliminates empty-body fns/methods')
console.log({
  elim_uncov_class_method: config.elim_uncov_class_method,
  elim_uncov_prop_method: config.elim_uncov_prop_method,
  elim_uncov_prop_fn_expr: config.elim_uncov_prop_fn_expr,
})
console.groupEnd()

code = (() => {
  const visitor = {}

  if (config.elim_uncov_class_method) {
    visitor.ClassMethod = (path) => (path.node.body.body.length === 0) && path.remove()
  }

  if (config.elim_uncov_prop_method) {
    visitor.ObjectMethod = (path) => (path.node.body.body.length === 0) && path.remove()
  }

  if (config.elim_uncov_prop_fn_expr) {
    visitor.ObjectProperty = (path) => (
      t.isFunctionExpression(path.node.value)
      && path.node.value.body.body.length === 0
    ) && path.remove()
  }

  const ast = parser.parse(code)
  traverse(ast, visitor)

  return generate(ast, {}, code).code
})()

// write
fs.writeFileSync(config.output, code)





// ---
// Pass 4
// ---

console.log()
console.group('Creates build')
console.log({
  compress: config.compress,
  mangle: config.mangle,
  minified: config.minified,
  output: config.output
})
console.groupEnd()

code = await (async () => {
  const bundle = await rollup({
    input: config.output,
    plugins: [terser({
      toplevel: true,
      compress: config.compress,
      mangle: config.mangle,
      format: {
        comments: false, // must
        beautify: !config.minified
      }
    })]
  })

  const { output } = await bundle.generate({})
  await bundle.close()

  return output[0].code
})()

// write
fs.writeFileSync(config.output, code)





// ---
// Pass 5
// ---

console.log()
console.group('Creates gzip build')
console.log({ output: config.output + '.gz' })

{
  const gz = zlib.createGzip()
  const src = createReadStream(config.output)
  const dst = createWriteStream(config.output + '.gz')
  const pipe = promisify(pipeline)
  try {
    await pipe(src, gz, dst)
  } catch (e) {
    console.error('err: failed to pipe')
    console.error(e)
    process.exit(-1)
  }
}

console.groupEnd()

// ---
// Pass 6
// ---

console.log()
console.group('Generates report')

{
  const entry = fs.statSync(config.input).size
  const build = fs.statSync(config.output).size
  const gzip = fs.statSync(config.output + '.gz').size

  const sz = (b) => {
    let size

    if (b < 1024) {
      size = b + 'b'
    } else if (b < 1024 ** 2) {
      size = Math.round(b / 1024) + 'Kb'
    } else {
      size = Math.round(b / 1024 / 1024) + 'Mb'
    }

    return { size }
  }

  console.table({
    entry: sz(entry),
    rollup: sz(size_rollup),
    dce: sz(size_dce),
    build: sz(build),
    gzip: sz(gzip)
  })
}

console.groupEnd()
console.log()
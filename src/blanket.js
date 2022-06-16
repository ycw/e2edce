import { chromium } from 'playwright'
import parser from '@babel/parser'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import * as t from '@babel/types'

const traverse = _traverse.default
const generate = _generate.default

export default async (test, headless) => {

  const browser = await chromium.launch({ headless })
  const page = await browser.newPage()
  await page.coverage.startJSCoverage({ resetOnNavigation: false })

  try {
    await test(page)
  } catch (e) {
    browser.close()
    throw e
  }

  const entries = await page.coverage.stopJSCoverage()

  browser.close()

  if (entries.length === 0) {
    return ''
  }

  const entry = entries[0]
  const uncov_fns = entry.functions.filter(f => !f.isBlockCoverage)

  const source = entry.source
  const tag = '@e2edce'
  const fn_block = `{/*${tag}*/}`

  let at = 0
  let new_source = []
  let stub_fn_idx = 0

  for (const { functionName, ranges } of uncov_fns) {
    for (const { startOffset, endOffset, count } of ranges) {

      if (count > 0) {
        continue
      }

      new_source.push(source.substring(at, startOffset))
      at = endOffset

      const fn_source = source.substring(startOffset, endOffset)
      const fn_name = (
        /[^0-9a-zA-Z$_]/.test(functionName)
        || !functionName
      ) ? '_e2edce_' + (stub_fn_idx++)
        : functionName

      // # Keep fn body for these
      //
      // - function(){}
      // - function f(){}
      // - async function(){}
      // - async function f(){}
      // - async function*(){}
      // - async function* f(){}
      // - ()=>{}
      // - ()=>0
      // - a=>{}
      // - a=>0
      // - async()=>{}
      // - async()=>0
      // - async a=>{}
      // - async a=>0
      //
      // # Replace fn body for these
      //
      // class K {            | const o = {
      //   f(){}              |   f(){},
      //   *gf(){}            |   *gf(){},
      //   [c](){}            |   [c](){},
      //   *[cgf](){}         |   *[cgf](){},
      //   get g(){}          |   get g(){},
      //   set s(v){}         |   set s(v){},
      //   async af(){}       |   async af(){},
      //   async [caf](){}    |   async [ac](){},
      //   async *[cagf](){}  |   async *[cagf](){}
      // }                    | }

      if (
        /^(async\s*?)*function\s*\*?/.test(fn_source)
        || fn_source?.startsWith('(')
        || /^[0-9a-zA-Z$_]+\s*=>/.test(fn_source)
        || /^async\s*\(/.test(fn_source)
        || /^async\s*[0-9a-zA-Z$_]+\s*=>/.test(fn_source)
      ) {
        new_source.push(fn_source)
      } else {
        if (/^(async\s*)?(\*\s*)?[0-9a-zA-Z$_]+\s*\(/.test(fn_source)) {
          new_source.push(`${fn_name}()${fn_block}`)
          continue
        }
        if (/^(async\s*)?(\*\s*)?\[/.test(fn_source)) {
          new_source.push(`[${fn_name}]()${fn_block}`)
          continue
        }
        if (/^get\s+/.test(fn_source)) {
          new_source.push(`get ${fn_name}()${fn_block}`)
          continue
        }
        if (/^set\s+/.test(fn_source)) {
          new_source.push(`set ${fn_name}(v)${fn_block}`)
          continue
        }

        console.log('unknown fn pattern', fn_source)
        new_source.push(fn_source)
      }
    }
  }

  new_source.push(source.substring(at))

  const tagged_code = new_source.join('')

  const ast = parser.parse(tagged_code, { sourceType: 'module' })

  traverse(ast, get_visitor(tag))

  return generate(ast, {}, tagged_code).code
}



function get_visitor(tag) {

  const is_tagged_fn = (body) =>
    body.innerComments?.[0].value.trim().startsWith(tag)

  /** @type import('@babel/traverse').Visitor */
  const visitor = {
    ClassMethod(path) {
      if (is_tagged_fn(path.node.body)) {
        path.remove()
      }
    },

    ObjectMethod(path) {
      if (is_tagged_fn(path.node.body)) {
        path.remove()
      }
    },

    ObjectProperty(path) {
      if (
        (
          t.isFunctionExpression(path.node.value)
          || t.isArrowFunctionExpression(path.node.value)
        )
        && is_tagged_fn(path.node.value.body)
      ) {
        path.remove()
      }
    },

    CallExpression(path) {
      if (path.node.callee.id?.name === '_e2edce_inject_') {
        path.remove()
      }
    }
  }

  return visitor
}
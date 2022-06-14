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

      const fn_source = source?.substring(startOffset, endOffset)
      const fn_name = (
        /[^0-9a-zA-Z$_]/.test(functionName)
        || !functionName
      ) ? '_e2edce_' + (stub_fn_idx++)
        : functionName

      if (fn_source.startsWith('function')) {
        new_source.push(`function ${fn_name}()${fn_block}`)
      } else if (fn_source.startsWith('async function')) { // async f and gf
        new_source.push(`async function ${fn_name}()${fn_block}`)
      } else if (fn_source.startsWith('async *')) { // async gf (method)
        new_source.push(`async *${fn_name}()${fn_block}`)
      } else if (fn_source.startsWith('*')) { // gf (method)
        new_source.push(`*${fn_name}()${fn_block}`)
      } else if (fn_source.startsWith('constructor')) { // class ctor
        new_source.push(`constructor()${fn_block}`)
      } else if (fn_source.startsWith('set ')) { // setter
        new_source.push(`${fn_name}(v)${fn_block}`)
      } else if ( // arrow fn 
        fn_source.startsWith('(') // `(a)=>{}`
        || /^[0-9a-zA-Z$_]+\s*=>/.test(fn_source) // `a=>{}`
      ) { 
        new_source.push(`()=>${fn_block}`)
      } else { // method
        new_source.push(`${fn_name}()${fn_block}`)
      }
    }
  }

  new_source.push(source?.substring(at))

  const tagged_code = new_source.join('')

  const ast = parser.parse(tagged_code, { sourceType: 'module' })

  traverse(ast, get_visitor(tag))

  return generate(ast, {}, tagged_code).code
}



function get_visitor(tag) {

  const is_tagged_fn = (body) =>
    body.body.length === 0 &&
    body.innerComments?.length === 1 &&
    body.innerComments[0].type === 'CommentBlock' &&
    body.innerComments[0].value.trim().startsWith(tag)

  return {
    ClassMethod(path) {
      if (is_tagged_fn(path.node.body)) {
        return path.remove()
      }
    },

    ObjectMethod(path) {
      if (is_tagged_fn(path.node.body)) {
        return path.remove()
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
        return path.remove()
      }
    }
  }
}
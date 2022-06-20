import { chromium } from 'playwright'
import parser from '@babel/parser'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import * as t from '@babel/types'

const traverse = _traverse.default
const generate = _generate.default

export default async (test, headless, debug) => {

  const browser = await chromium.launch({ headless })
  const page = await browser.newPage()
  await page.coverage.startJSCoverage({ resetOnNavigation: true })

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

  const tag = '@e2edce'
  const new_source = []

  let at = 0

  for (const { functionName, ranges } of uncov_fns) {
    for (const { startOffset, endOffset, count } of ranges) {

      if (count > 0) {
        continue
      }

      new_source.push(entry.source.substring(at, startOffset))
      at = endOffset

      const fn_source = entry.source.substring(startOffset, endOffset)

      new_source.push(`/*${tag} ${functionName}*/${fn_source}`) // leading comment
    }
  }

  new_source.push(entry.source.substring(at))

  const tagged_code = new_source.join('')

  const ast = parser.parse(tagged_code, { sourceType: 'module' })

  traverse(ast, get_visitor(tag, debug))

  return generate(ast, {}, tagged_code).code
}



function get_visitor(tag, debug) {

  const dbg_fn_block = t.blockStatement([
    t.throwStatement(
      t.stringLiteral('@e2edce: uncoverage')
    )
  ])

  /** @type import('@babel/traverse').Visitor */
  const visitor = {
    ClassMethod(path) {
      if (path.node.leadingComments?.at(-1)?.value.trim().startsWith(tag)) {
        if (debug) {
          t.removeComments(path.node)
          path.replaceWith(
            t.classMethod(
              path.node.kind,
              path.node.key,
              path.node.params,
              dbg_fn_block,
              path.node.computed,
              path.node.static,
              path.node.generator,
              path.node.async
            )
          )
        } else {
          path.replaceWith(t.emptyStatement())
        }
      }
    },

    ObjectMethod(path) {
      if (path.node.leadingComments?.at(-1)?.value.trim().startsWith(tag)) {
        if (debug) {
          t.removeComments(path.node)
          path.replaceWith(
            t.objectMethod(
              path.node.kind,
              path.node.key,
              path.node.params,
              dbg_fn_block
            )
          )
        } else {
          path.remove()
        }
      }
    },

    ObjectProperty(path) {
      if (
        (
          t.isFunctionExpression(path.node.value)
          || t.isArrowFunctionExpression(path.node.value)
        )
        && path.node.value.leadingComments?.at(-1)?.value.trim().startsWith(tag)
      ) {
        if (debug) {
          t.removeComments(path.node)
          path.replaceWith(
            t.objectProperty(
              path.node.key,
              t.isFunctionExpression(path.node.value)
                ? t.functionExpression(
                  path.node.value.id,
                  path.node.value.params,
                  dbg_fn_block,
                  path.node.value.generator,
                  path.node.value.async
                )
                : t.arrowFunctionExpression(
                  path.node.value.params,
                  dbg_fn_block,
                  path.node.value.async
                )
            )
          )
        } else {
          path.remove()
        }
      }
    },

    FunctionDeclaration(path) {
      if (path.node.leadingComments?.at(-1)?.value.trim().startsWith(tag)) {
        if (debug) {
          t.removeComments(path.node)
          path.replaceWith(
            t.functionDeclaration(
              path.node.id,
              path.node.params,
              dbg_fn_block,
              path.node.generator,
              path.node.async
            )
          )
        } else {
          t.removeComments(path.node)
          path.replaceWith(
            t.functionDeclaration(
              path.node.id,
              path.node.params,
              t.blockStatement([]),
              path.node.generator,
              path.node.async
            )
          )
        }
      }
    }
  }

  return visitor
}
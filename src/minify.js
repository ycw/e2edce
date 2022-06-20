import { rollup } from 'rollup'
import { minify } from 'terser'
import parser from '@babel/parser'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'

const traverse = _traverse.default
const generate = _generate.default

export default async (input_code, compress, mangle, beautify) => {

  if (mangle === true) {
    mangle = {}
  }

  if (typeof mangle === 'object') {
    if (Array.isArray(mangle.reserved)) {
      mangle.reserved.push('_e2edce_inject_')
    } else {
      mangle.reserved = ['_e2edce_inject_']
    }
  }

  const { code } = await minify(input_code, {
    module: true,
    compress,
    mangle,
    format: {
      beautify,
      comments: false
    }
  })

  // now, rm inject_fn from minified code

  const ast = parser.parse(code, { sourceType: 'module' })

  traverse(ast, get_visitor())

  return generate(
    ast,
    { minified: !beautify },
    code
  ).code
}



function get_visitor() {

  /** @type import('@babel/traverse').Visitor */
  const visitor = {
    CallExpression(path) {
      if (path.node.callee.name === '_e2edce_inject_') {
        path.remove()
      }
    },
    FunctionDeclaration(path) {
      if (path.node.id?.name === '_e2edce_inject_') {
        path.remove()
      }
    }
  }

  return visitor
}
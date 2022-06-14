import { rollup } from 'rollup'
import node_resolve from '@rollup/plugin-node-resolve'
import { babel } from '@rollup/plugin-babel'
import * as t from '@babel/types'

export default async (input_path) => {

  const bundle = await rollup({
    input: input_path,
    plugins: [
      babel({
        babelHelpers: 'bundled',
        plugins: [
          rewrite_source()
        ]
      }),
      node_resolve()
    ]
  })

  const { output } = await bundle.generate({})
  await bundle.close()

  return output[0].code
}



function rewrite_source() {
  return {
    visitor: {
      ImportDeclaration(path) {
        if (path.node.source.value === 'three') {
          path.replaceWith(
            t.importDeclaration(
              path.node.specifiers,
              t.stringLiteral('three/src/Three')
            )
          )
        }
      }
    }
  }
}
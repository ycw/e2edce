import { rollup } from 'rollup'
import node_resolve from '@rollup/plugin-node-resolve'
import { babel } from '@rollup/plugin-babel'
import * as t from '@babel/types'
import fs from 'node:fs/promises'

export default async (input_path, output_path, inject_fn) => {

  const input_source = await fs.readFile(input_path)

  const tampered_source = `
    ${input_source}
    ;(function _e2edce_inject_() {
      (${inject_fn.toString()})()
    })();
  `

  await fs.writeFile(output_path, tampered_source)

  const bundle = await rollup({
    input: output_path,
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
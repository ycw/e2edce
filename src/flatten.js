import { rollup } from 'rollup'
import node_resolve from '@rollup/plugin-node-resolve'
import fs from 'node:fs/promises'

export default async (input_path, inject_fn, resolve_fn) => {

  const input_source = await fs.readFile(input_path)

  const inject_code = `;
    function _e2edce_inject_() {
      (${inject_fn.toString()})()
    }
    /*#__NOINLINE__*/_e2edce_inject_();
  `

  const tampered_source = `
    ${input_source}
    ${inject_code}  
  `

  const tmp_file_path = input_path + '.e2edce.flatten.js'

  await fs.writeFile(tmp_file_path, tampered_source)

  const plugins = []

  if (resolve_fn) {
    plugins.push({
      name: '',
      resolveId: resolve_fn
    })
  }

  plugins.push(node_resolve())

  const bundle = await rollup({
    input: tmp_file_path,
    plugins,
  })

  await fs.unlink(tmp_file_path)

  const { output } = await bundle.generate({})
  await bundle.close()

  return [output[0].code, inject_code]
}

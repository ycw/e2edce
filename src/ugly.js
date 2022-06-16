import { rollup } from 'rollup'
import { terser } from 'rollup-plugin-terser'

export default async ({
  input,
  compress,
  mangle,
  minify
}) => {

  const bundle = await rollup({
    input,
    plugins: [
      terser({
        toplevel: true,
        compress,
        mangle,
        format: {
          beautify: !minify,
          comments: false
        }
      })
    ]
  })

  const { output } = await bundle.generate({})

  await bundle.close()

  return output[0].code
}
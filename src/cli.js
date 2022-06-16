#!/usr/bin/env node

import fs from 'node:fs/promises'
import get_configs from './config.js'
import serve from './server.js'
import bundle from './rollup.js'
import cover from './blanket.js'
import uglify from './ugly.js'
import gzip from './gzip.js'

const configs = await get_configs(process.argv[2])

for (const [config, test_obj] of configs) {

  console.log('Config', config)

  const stop_server = await serve(config.port, process.cwd())

  try {

    const bundled_code = await bundle(config.input, config.output, test_obj.inject)

    await fs.writeFile(config.output, bundled_code)

    if (config.debug) {
      await fs.writeFile(config.output + '.0_bundled_code.js', bundled_code)
    }

    const dce_code = await cover(test_obj.test, config.headless)

    await fs.writeFile(config.output, dce_code)

    if (config.debug) {
      await fs.writeFile(config.output + '.1_dce_code.js', dce_code)
    }

    const ugly_code = await uglify({
      input: config.output,
      compress: config.compress,
      mangle: config.mangle,
      minify: config.minify
    })

    await fs.writeFile(config.output, ugly_code)

    if (config.debug) {
      await fs.writeFile(config.output + '.2_ugly_code.js', ugly_code)
    }

    const gz_size = await gzip(config.output, config.output + '.gz')

    console.table({
      bundle: size_of(bundled_code.length),
      dce: size_of(dce_code.length),
      build: size_of(ugly_code.length),
      gzip: size_of(gz_size)
    })

    console.log('\n')

  } finally {

    await stop_server()
  }
}



function size_of(s) {
  let size = '0b'

  if (s < 1024) {
    size = s + 'b'
  } else if (s < 1024 * 1024) {
    size = (s / 1024).toFixed(2) + 'Kb'
  } else {
    size = (s / 1024 / 1024).toFixed(2) + 'Mb'
  }

  return { size }
}
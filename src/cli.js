#!/usr/bin/env node

import fs from 'node:fs/promises'
import get_configs from './config.js'
import serve from './server.js'
import flatten from './flatten.js'
import blanket from './blanket.js'
import minify from './minify.js'
import gzip from './gzip.js'

const { setup, teardown, resolve, configs } = await get_configs(process.argv[2])

if (setup) {
  await setup()
}

for (const [config, test_obj] of configs) {

  console.log('Config', config)

  const stop_server = await serve(config.port, process.cwd())

  try {

    const [flat_code, _inject_code] = await flatten(
      config.input,
      test_obj.inject,
      resolve,
      config.visitor
    )

    await fs.writeFile(config.output, flat_code)

    let blanket_code
    try {
      blanket_code = await blanket(
        test_obj.test,
        config.headless,
        config.debug
      )
    } catch {
      process.exit(-1)
    }

    const minified_code = await minify(
      blanket_code,
      config.compress,
      config.mangle,
      config.beautify
    )

    await fs.writeFile(config.output, minified_code)

    const sz_gzipped = await gzip(
      minified_code,
      config.output + '.gz'
    )

    const report = gen_report([
      { id: 'flat', sz: flat_code.length },
      { id: 'dce', sz: blanket_code.length },
      { id: 'min', sz: minified_code.length },
      { id: 'min+gz', sz: sz_gzipped }
    ])

    console.table(report)
    console.log('\n')

  } finally {

    await stop_server()
  }
}

if (teardown) {
  await teardown()
}



function gen_report(records) {
  const report = {}
  records.forEach(({ id, sz }) => report[id] = fmt_size(sz))
  return report
}

function fmt_size(s) {
  let size

  if (s < 1024) {
    size = String(s) + 'b'
  } else if (s < 1024 * 1024) {
    size = (s / 1024).toFixed(2) + 'Kb'
  } else {
    size = (s / 1024 / 1024).toFixed(2) + 'Mb'
  }

  return { size }
}
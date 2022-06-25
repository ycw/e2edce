import url from 'node:url'

export default async (config_file_path) => {

  if (!config_file_path) {
    console.error('Error: Missing config file')
    console.error('Usage: npx e2edce config.js')
    process.exit(1)
  }

  const default_config = {
    // --- required ---
    input: undefined,
    output: undefined,
    test: undefined,
    // --- optional ---
    visitor: undefined, // a babel visitor; during flatten code
    compress: true,
    mangle: true,
    beautify: false,
    debug: false,
    headless: true,
    port: 8081,
  }

  const default_global_config = {
    configs: undefined, // required
    setup: undefined,
    resolve: undefined,
    teardown: undefined
  }

  const global_config = (
    await import(url.pathToFileURL(config_file_path))
  ).default

  Object.keys(global_config)
    .filter(k => !Object.hasOwn(default_global_config, k))
    .forEach(k => console.warn(`Ignored unknown global config field "${k}"`))

  const computed_configs = []

  for (const config of global_config.configs) {

    const computed_config = { ...default_config, ...config } // shallow

    if (typeof computed_config.compress === 'object') {
      computed_config.compress = { ...computed_config.compress }
    }

    if (typeof computed_config.mangle === 'object') {
      computed_config.mangle = { ...computed_config.mangle }
    }

    Object.keys(computed_config)
      .filter(k => !Object.hasOwn(default_config, k))
      .forEach(k => {
        delete computed_config[k]
        console.warn(`Deleted unknown field "${k}" from config`)
      })

    if (!computed_config.input) {
      console.error('Missing config.input')
      process.exit(1)
    }

    if (!computed_config.output) {
      console.error('Missing config.output')
      process.exit(1)
    }

    if (!computed_config.test) { // path to test file
      console.error('Missing config.test')
      process.exit(1)
    }

    let test_obj = (
      await import(url.pathToFileURL(computed_config.test))
    ).default

    if (typeof test_obj === 'function') {
      test_obj = { test: test_obj }
    }

    if (typeof test_obj.test !== 'function') {
      console.error('Missing test fn in test file')
      process.exit(1)
    }

    if (typeof test_obj.inject !== 'function') {
      test_obj.inject = () => { }
    }

    if (computed_config.debug) {
      computed_config.compress = false
      computed_config.mangle = false
      computed_config.beautify = true
    }

    computed_configs.push([computed_config, test_obj])
  }

  return {
    setup: global_config.setup,
    teardown: global_config.teardown,
    resolve: global_config.resolve,
    configs: computed_configs
  }
}
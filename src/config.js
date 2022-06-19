import url from 'node:url'

export default async (config_file_path) => {

  if (!config_file_path) {
    console.error('Error: Missing config file')
    console.error('Usage: npx e2edce config.js')
    process.exit(1)
  }

  const default_config = {
    input: undefined,
    output: undefined,
    test: undefined,
    compress: true,
    mangle: true,
    minify: true,
    debug: false,
    headless: true,
    port: 8081,
  }

  const default_global_config = {
    configs: undefined, // required
    setup: undefined,  // optional
    resolve: undefined, // optional
    teardown: undefined // optional
  }

  const global_config = (
    await import(url.pathToFileURL(config_file_path))
  ).default

  Object.keys(global_config)
    .filter(k => !Object.hasOwn(default_global_config, k))
    .forEach(k => console.warn('unknown global config field:', k))

  const computed_configs = []

  for (const config of global_config.configs) {

    Object.keys(config)
      .filter(k => !Object.hasOwn(default_config, k))
      .forEach(k => console.warn('Unknown config field', unknown_fields))

    const computed_config = Object.assign({}, default_config, config)

    if (!computed_config.input) {
      console.error('.input is required in config file')
      process.exit(1)
    }

    if (!computed_config.output) {
      console.error('.output is required in config file')
      process.exit(1)
    }

    if (!computed_config.test) {
      console.error('.test is required in config file')
      process.exit(1)
    }

    let test_obj = (
      await import(url.pathToFileURL(computed_config.test))
    ).default

    if (typeof test_obj === 'function') {
      test_obj = { test: test_obj }
    }

    if (typeof test_obj.test !== 'function') {
      console.error('.test is required to be fn')
      process.exit(1)
    }

    if (typeof test_obj.inject !== 'function') {
      test_obj.inject = () => { }
    }

    if (computed_config.debug) {
      computed_config.compress = false
      computed_config.mangle = false
      computed_config.minify = false
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
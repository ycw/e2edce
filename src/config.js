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
    headless: true,
    port: 8081,
    debug: false
  }

  let user_configs = (
    await import(url.pathToFileURL(config_file_path))
  ).default

  if (!Array.isArray(user_configs)) {
    user_configs = [user_configs]
  }

  const configs = []

  for (const user_config of user_configs) {

    const unknown_fields = Object.keys(user_config)
      .filter(k => !Object.hasOwn(default_config, k))

    if (unknown_fields.length) {
      console.warn('Unknown fields', unknown_fields)
    }

    const config = Object.assign({}, default_config, user_config)

    if (!config.input) {
      console.error('.input is required in config file')
      process.exit(1)
    }

    if (!config.output) {
      console.error('.output is required in config file')
      process.exit(1)
    }

    if (!config.test) {
      console.error('.test is required in config file')
      process.exit(1)
    }

    let test_obj = (
      await import(url.pathToFileURL(user_config.test))
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

    configs.push([config, test_obj])
  }

  return configs
}
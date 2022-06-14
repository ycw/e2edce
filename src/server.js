import { startDevServer } from '@web/dev-server'

export default async (port, rootDir) => {

  const server = await startDevServer({
    logStartMessage: false,
    config: { port, rootDir }
  })

  return server.stop.bind(server)
} 
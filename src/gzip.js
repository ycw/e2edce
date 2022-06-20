import { createWriteStream } from 'node:fs'
import { pipeline, Readable } from 'node:stream'
import { promisify } from 'node:util'
import { createGzip } from 'node:zlib'
import { stat } from 'node:fs/promises'

export default async (input_code, output_path) => {

  await promisify(pipeline)(
    Readable.from(input_code),
    createGzip(),
    createWriteStream(output_path)
  )

  return (await stat(output_path)).size
}
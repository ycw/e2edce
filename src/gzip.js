import { createReadStream, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'
import zlib from 'node:zlib'
import { stat } from 'node:fs/promises'

export default async (input_path, output_path) => {
  
  await promisify(pipeline)(
    createReadStream(input_path), 
    zlib.createGzip(), 
    createWriteStream(output_path)
  )

  return (await stat(output_path)).size
}
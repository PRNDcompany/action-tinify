import {debug, info} from '@actions/core'
import {existsSync} from 'fs'
import {minimatch} from 'minimatch'
import {getType} from 'mime'
import Image from './image'

/** @see https://tinypng.com/developers/reference#compressing-images */
const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default class Images implements Iterable<Image> {
  private readonly excludePatterns: string[]
  private readonly filenames = new Set<string>()
  private readonly images: Image[] = []

  constructor(excludePatterns: string[] = []) {
    this.excludePatterns = excludePatterns
  }

  private isExcluded(filename: string): boolean {
    return this.excludePatterns.some(pattern =>
      minimatch(filename, pattern, {dot: true})
    )
  }

  addFile(filename: string): void {
    if (this.isExcluded(filename)) {
      debug(`[${filename}] Skipping excluded file`)
      return
    }

    if (!existsSync(filename)) {
      debug(`[${filename}] Skipping nonexistent file`)
      return
    }

    if (this.filenames.has(filename)) {
      debug(`[${filename}] Skipping duplicate file`)
      return
    }

    const mimeType = getType(filename)

    if (null === mimeType) {
      debug(`[${filename}] Skipping file with unknown mime type`)
      return
    }

    if (-1 === SUPPORTED_MIME_TYPES.indexOf(mimeType)) {
      debug(
        `[${filename}] Skipping file with unsupported mime type ${mimeType}`
      )
      return
    }

    info(`[${filename}] Adding ${mimeType} image`)

    this.filenames.add(filename)
    this.images.push(new Image(filename))
  }

  [Symbol.iterator](): IterableIterator<Image> {
    return this.images.values()
  }
}

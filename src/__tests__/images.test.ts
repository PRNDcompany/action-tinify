import {beforeEach, describe, expect, jest, test} from '@jest/globals'
import {existsSync} from 'fs'
import {getType} from 'mime'
import Images from '../images'

jest.mock('@actions/core')
jest.mock('mime')
jest.mock('fs', () => {
  const actual = jest.requireActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: jest.fn()
  }
})

const mockedExistsSync = existsSync as jest.MockedFunction<typeof existsSync>
const mockedGetType = getType as jest.MockedFunction<typeof getType>

beforeEach(() => {
  mockedExistsSync.mockReturnValue(true)
  mockedGetType.mockReturnValue('image/png')
})

function getFilenames(images: Images): string[] {
  return [...images].map(img => img.getFilename())
}

describe('Images excludePatterns', () => {
  test('backward compatibility: no excludePatterns → addFile works normally', () => {
    const images = new Images()
    images.addFile('src/photo.png')

    expect(getFilenames(images)).toEqual(['src/photo.png'])
  })

  test('single pattern excludes matching file', () => {
    const images = new Images(['docs/**'])
    images.addFile('docs/image.png')

    expect(getFilenames(images)).toEqual([])
  })

  test('multiple patterns exclude respective matching files', () => {
    const images = new Images(['docs/**', '**/thumbnails/**'])
    images.addFile('docs/image.png')
    images.addFile('assets/thumbnails/thumb.png')
    images.addFile('src/photo.png')

    expect(getFilenames(images)).toEqual(['src/photo.png'])
  })

  test('non-matching file passes through when pattern does not match', () => {
    const images = new Images(['docs/**'])
    images.addFile('src/image.png')

    expect(getFilenames(images)).toEqual(['src/image.png'])
  })

  test('glob wildcard pattern excludes by extension', () => {
    const images = new Images(['**/*.png'])
    images.addFile('src/photo.png')
    images.addFile('assets/icon.png')

    expect(getFilenames(images)).toEqual([])
  })

  test('dot file pattern excludes hidden directory files (dot: true)', () => {
    const images = new Images(['.hidden/**'])
    images.addFile('.hidden/image.png')

    expect(getFilenames(images)).toEqual([])
  })

  test('empty patterns array excludes nothing', () => {
    const images = new Images([])
    images.addFile('src/photo.png')
    images.addFile('docs/image.png')

    expect(getFilenames(images)).toEqual(['src/photo.png', 'docs/image.png'])
  })
})

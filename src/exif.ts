import {debug, warning} from '@actions/core'
import {exec, ExecOptions} from '@actions/exec'

export enum Tag {
  Software = 'Software',
  XMPToolkit = 'xmptoolkit'
}

const EXIFTOOL_PACKAGE = 'libimage-exiftool-perl'

export async function ensureExifTool(): Promise<void> {
  try {
    await exec('exiftool', ['-ver'])
    return
  } catch (error) {
    if (error instanceof Error && error.stack) {
      debug(error.stack)
    }
  }

  try {
    const env = {
      ...process.env,
      DEBIAN_FRONTEND: 'noninteractive'
    }

    await exec('sudo', ['apt-get', 'update'], {env})
    await exec('sudo', ['apt-get', 'install', '-y', EXIFTOOL_PACKAGE], {env})
    await exec('exiftool', ['-ver'])
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    warning(
      `Failed to install ExifTool automatically. Continuing without auto-install: ${message}`
    )

    if (error instanceof Error && error.stack) {
      debug(error.stack)
    }
  }
}

export default class Exif {
  private static COMMAND = 'exiftool'

  constructor(private filename: string) {}

  async get(tags: Tag[] = []): Promise<string> {
    let output = ''

    const options: ExecOptions = {
      listeners: {
        stdout(data: Buffer) {
          output += data.toString()
        }
      }
    }

    await exec(
      Exif.COMMAND,
      ['-veryShort', '-tab', ...tags.map(tag => `-${tag}`), this.filename],
      options
    )

    return output
  }

  async set(inputs: [Tag, string][]): Promise<boolean> {
    return Boolean(
      await exec(Exif.COMMAND, [
        ...inputs.map(input => `-${input[0]}=${input[1]}`),
        this.filename
      ])
    )
  }
}

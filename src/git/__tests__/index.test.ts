import {exec} from '@actions/exec'
import {Context} from '@actions/github/lib/context'
import {beforeEach, describe, expect, jest, test} from '@jest/globals'
import nock, {Scope} from 'nock'
import Git from '..'
import Image from '../../image'

jest.mock('@actions/exec')

const mockedExec = jest.mocked(exec)

describe('Git', () => {
  let scope: Scope

  beforeEach(() => {
    scope = nock(/api\.github\.com/)
    mockedExec.mockClear()
    mockedExec.mockResolvedValue(0)
  })

  describe('getFiles', () => {
    describe('push', () => {
      beforeEach(() => {
        scope.get('/repos/OWNER/REPO/commits/C1').reply(200, {
          files: [
            {
              id: 1,
              status: 'added'
            },
            {
              id: 2,
              status: 'removed'
            }
          ]
        })

        scope.get('/repos/OWNER/REPO/commits/C2').reply(200, {
          files: [
            {
              id: 3,
              status: 'modified'
            }
          ]
        })
      })

      test('should fetch files', async () => {
        const files = await new Git({
          token: 'TOKEN',
          context: {
            eventName: 'push',
            payload: {
              commits: [{id: 'C1'}, {id: 'C2'}]
            },
            repo: {
              owner: 'OWNER',
              repo: 'REPO'
            }
          } as unknown as Context
        }).getFiles()

        expect(files).toEqual([
          {
            id: 1,
            status: 'added'
          },
          {
            id: 3,
            status: 'modified'
          }
        ])

        expect(scope.isDone()).toBe(true)
      })
    })

    describe('pull_request', () => {
      beforeEach(() => {
        scope.get('/repos/OWNER/REPO/pulls/1/files').reply(200, [
          {
            id: 1,
            status: 'added'
          },
          {
            id: 2,
            status: 'removed'
          },
          {
            id: 3,
            status: 'modified'
          }
        ])
      })

      test('should fetch files', async () => {
        const files = await new Git({
          token: 'TOKEN',
          context: {
            eventName: 'pull_request',
            payload: {
              number: 1
            },
            repo: {
              owner: 'OWNER',
              repo: 'REPO'
            }
          } as unknown as Context
        }).getFiles()

        expect(files).toEqual([
          {
            id: 1,
            status: 'added'
          },
          {
            id: 3,
            status: 'modified'
          }
        ])

        expect(scope.isDone()).toBe(true)
      })
    })
  })

  describe('commit', () => {
    function createImage(): Image {
      const image = new Image('static/a.png')
      jest.spyOn(image, 'getCompressionSummary').mockReturnValue('-1 kB (-10%)')
      return image
    }

    function createGit(): Git {
      return new Git({
        token: 'TOKEN',
        context: {
          eventName: 'push',
          ref: 'refs/heads/feature',
          payload: {},
          repo: {
            owner: 'OWNER',
            repo: 'REPO'
          }
        } as unknown as Context
      })
    }

    test('should create a branch and pull request', async () => {
      scope
        .get('/repos/OWNER/REPO/pulls')
        .query({head: 'OWNER:tinify/feature', base: 'feature', state: 'open'})
        .reply(200, [])

      scope
        .post('/repos/OWNER/REPO/pulls', body => {
          return body.head === 'tinify/feature' && body.base === 'feature'
        })
        .reply(201, {html_url: 'URL', number: 1})

      await createGit().commit({
        files: [createImage()],
        userName: 'NAME',
        userEmail: 'EMAIL',
        message: 'MESSAGE'
      })

      expect(mockedExec).toHaveBeenCalledWith('git', [
        'checkout',
        '-B',
        'tinify/feature'
      ])
      expect(mockedExec).toHaveBeenCalledWith('git', [
        'push',
        '--force',
        'origin',
        'tinify/feature'
      ])
      expect(scope.isDone()).toBe(true)
    })

    test('should skip creation when a pull request already exists', async () => {
      scope
        .get('/repos/OWNER/REPO/pulls')
        .query({head: 'OWNER:tinify/feature', base: 'feature', state: 'open'})
        .reply(200, [{html_url: 'EXISTING'}])

      await createGit().commit({
        files: [createImage()],
        userName: 'NAME',
        userEmail: 'EMAIL',
        message: 'MESSAGE'
      })

      expect(scope.isDone()).toBe(true)
    })
  })
})

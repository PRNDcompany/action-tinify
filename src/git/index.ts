import {info} from '@actions/core'
import {exec} from '@actions/exec'
import * as github from '@actions/github'
import {Context} from '@actions/github/lib/context'
import {GitHub} from '@actions/github/lib/utils'
import {Endpoints} from '@octokit/types'
import {
  assertUnsupportedEvent,
  getCommitBody,
  getCommitMessage
} from './functions'
import {Commit, File, SupportedContext, isPullRequestContext} from './types'

/** Prefix for the branch that holds the compression commit */
const HEAD_BRANCH_PREFIX = 'tinify'

interface Dependencies {
  readonly token: string
  readonly context: Context
}

export default class Git {
  private octokit: InstanceType<typeof GitHub>
  private context: SupportedContext

  constructor({token, context}: Dependencies) {
    this.octokit = github.getOctokit(token)
    this.context = context as SupportedContext
  }

  async getFiles(): Promise<File[]> {
    const filesPromises: Array<Promise<File[]>> = []

    switch (this.context.eventName) {
      case 'push':
        for (const commit of this.context.payload.commits) {
          const ref = commit.id

          info(`[${this.context.eventName}] Fetching files for commit ${ref}`)
          filesPromises.push(
            this.getCommitFiles({
              ...this.context.repo,
              ref
            })
          )
        }
        break
      case 'pull_request':
        info(
          `[${this.context.eventName}] Fetching files for pull request ${this.context.payload.number}`
        )

        filesPromises.push(
          this.octokit.paginate(
            'GET /repos/{owner}/{repo}/pulls/{pull_number}/files',
            {
              ...this.context.repo,
              pull_number: this.context.payload.number
            }
          )
        )
        break
      default:
        assertUnsupportedEvent(this.context)
    }

    const files = await Promise.all(filesPromises)

    return files.reduce((result, value) => {
      result.push(
        ...value.filter(
          file => -1 !== ['added', 'modified'].indexOf(file.status)
        )
      )

      return result
    }, [])
  }

  async commit(commit: Commit): Promise<void> {
    const baseBranch = this.getBaseBranch()
    const headBranch = `${HEAD_BRANCH_PREFIX}/${baseBranch}`

    info('Configuring git')
    await exec('git', ['config', 'user.name', commit.userName])
    await exec('git', ['config', 'user.email', commit.userEmail])

    info(`Creating branch ${headBranch}`)
    await exec('git', ['checkout', '-B', headBranch])

    info('Adding modified images')
    await exec('git', [
      'add',
      ...commit.files.map(image => image.getFilename())
    ])

    info('Create commit')
    await exec('git', [
      'commit',
      `--message=${getCommitMessage(commit)}`,
      `--message=${getCommitBody(commit)}`
    ])

    info(`Pushing branch ${headBranch}`)
    await exec('git', ['push', '--force', 'origin', headBranch])

    await this.createPullRequest({baseBranch, headBranch, commit})
  }

  private async getCommitFiles(
    params: Endpoints['GET /repos/{owner}/{repo}/commits/{ref}']['parameters']
  ): Promise<File[]> {
    const files = (await this.octokit.rest.repos.getCommit(params)).data.files

    if (!files) {
      throw new Error('Error fetching commit files')
    }

    return files
  }

  /** Branch that triggered the action, used as the pull request base */
  private getBaseBranch(): string {
    if (isPullRequestContext(this.context)) {
      return this.context.payload.pull_request.head.ref
    }

    return this.context.ref.replace(/^refs\/heads\//, '')
  }

  private async createPullRequest({
    baseBranch,
    headBranch,
    commit
  }: {
    baseBranch: string
    headBranch: string
    commit: Commit
  }): Promise<void> {
    const head = `${this.context.repo.owner}:${headBranch}`

    info(`Looking for an existing pull request from ${headBranch}`)
    const existing = await this.octokit.rest.pulls.list({
      ...this.context.repo,
      head,
      base: baseBranch,
      state: 'open'
    })

    if (existing.data.length) {
      info(`Pull request already exists: ${existing.data[0].html_url}`)
      return
    }

    info(`Creating pull request ${headBranch} -> ${baseBranch}`)
    const {data} = await this.octokit.rest.pulls.create({
      ...this.context.repo,
      title: getCommitMessage(commit),
      body: getCommitBody(commit),
      head: headBranch,
      base: baseBranch
    })

    info(`Created pull request: ${data.html_url}`)
  }
}

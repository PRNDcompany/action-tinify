[![ci](https://github.com/PRNDcompany/action-tinify/actions/workflows/ci.yml/badge.svg)](https://github.com/PRNDcompany/action-tinify/actions/workflows/ci.yml)

# Tinify Image Action

[GitHub Action](https://github.com/features/actions) to compress and resize images with the [Tinify API](https://tinypng.com/developers).

![Example commit](https://i.imgur.com/FWOosON.png)

## Features

- filters PNG, JPEG, and WebP files in a commit or pull request
- optionally scales images proportionally
- sets Exif metadata to prevent duplicate compressions
- opens a pull request with compression metrics

## Usage

For example, on [`pull_request` events](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions#onpushpull_requestpaths) with modified files inside the `static` directory:

```yaml
name: Compress Images

on:
  pull_request:
    paths:
      - 'static/**'

jobs:
  compress:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.head_ref }}
      - name: Install ExifTool
        run: sudo apt-get update && sudo apt-get install -y libimage-exiftool-perl
      - uses: PRNDcompany/action-tinify@v1
        with:
          api_key: ${{ secrets.TINIFY_API_KEY }}
```

The action commits compressed images to a `tinify/<branch>` branch and opens a pull request targeting the branch that triggered the workflow. The `contents: write` and `pull-requests: write` permissions are required.

### Excluding Paths

To exclude certain paths from compression, use the `exclude_paths` input with newline-separated glob patterns:

```yaml
- uses: PRNDcompany/action-tinify@v1
  with:
    api_key: ${{ secrets.TINIFY_API_KEY }}
    exclude_paths: |
      docs/**
      **/thumbnails/**
```

### Events

The following [webhook events](https://docs.github.com/en/actions/reference/events-that-trigger-workflows#webhook-events) are supported:

- `pull_request`
- `push`

> [!IMPORTANT]  
> In pull request contexts, [`actions/checkout`](https://github.com/actions/checkout) checkouts a _merge_ commit by default. You must checkout the pull request _HEAD_ commit by overriding the `ref` input as illustrated above and as noted in [their documentation](https://github.com/actions/checkout#Checkout-pull-request-HEAD-commit-instead-of-merge-commit).

### Pull Request Behavior

Compressed images are committed to a `tinify/<branch>` branch (force-pushed on each run) and a pull request is opened against the branch that triggered the workflow. If an open pull request from `tinify/<branch>` already exists, it is reused instead of creating a duplicate.

Pull requests opened by the default `GITHUB_TOKEN` [will **not** trigger a new workflow run](https://docs.github.com/en/actions/security-guides/automatic-token-authentication#using-the-github_token-in-a-workflow) to prevent accidental recursion.

If you want the pull request to trigger further workflow runs, provide a [personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) via the `github_token` input:

```yaml
- uses: PRNDcompany/action-tinify@v1
  with:
    api_key: ${{ secrets.TINIFY_API_KEY }}
    github_token: ${{ secrets.PERSONAL_ACCESS_TOKEN }}
```

### Inputs

| input               | description                                                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`api_key`**       | Required Tinify API key (create one [here](https://tinypng.com/developers))                                                                                                |
| `github_token`      | Repository `GITHUB_TOKEN` or personal access token secret; defaults to [`github.token`](https://docs.github.com/en/actions/security-guides/automatic-token-authentication) |
| `commit_user_name`  | Git user.name, defaults to `github.actor`                                                                                                                                  |
| `commit_user_email` | Git user.email, defaults to `<github.actor>@users.noreply.github.com`                                                                                                      |
| `commit_message`    | Custom commit message, defaults to `Compress image(s)`                                                                                                                     |
| `resize_width`      | Maximum target image width                                                                                                                                                 |
| `resize_height`     | Maximum target image height                                                                                                                                                |
| `exclude_paths`     | Newline-separated glob patterns to exclude from compression                                                                                                                |

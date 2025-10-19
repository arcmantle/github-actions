# Detect Package Changes Action

This GitHub Action detects which packages have changed based on git diff and a configuration file. It's designed to work with monorepo setups where you want to sync specific packages to separate repositories.

## Features

- Detects changed files between two git references
- Compares changes against a configuration file to determine affected packages
- Outputs a matrix of changed packages for use in subsequent workflow steps
- Handles edge cases like force pushes and missing commits
- Validates JSON configuration before processing
- Clean separation between GitHub Actions integration (`main.ts`) and core logic (`detect-changes.ts`)
- Built with TypeScript using `@actions/core`

## Architecture

The action follows a clean architecture pattern:

- **`src/main.ts`** - GitHub Actions entry point that handles inputs/outputs and logging
- **`src/detect-changes.ts`** - Pure business logic with no GitHub Actions dependencies
- **`dist/main.js`** - Bundled output created by tsdown

This design makes the core logic testable and reusable outside of GitHub Actions.

## Development

### Building the Action

```bash
cd detect-changes
pnpm install
pnpm run build
```

This uses `tsdown` to compile and bundle `src/main.ts` to `dist/main.js` with all dependencies included.

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `config-file` | Path to the subtree-sync configuration file | No | `.github/subtree-sync.json` |
| `base-ref` | Base commit reference to compare against | No | `''` (falls back to HEAD~1) |
| `head-ref` | Head commit reference to compare | No | `HEAD` |

## Outputs

| Output | Description |
|--------|-------------|
| `matrix` | JSON string array of changed packages with `packagePath` and `targetRepo` fields |
| `has-changes` | String boolean indicating if any packages have changes (`'true'` or `'false'`) |
| `changed-files` | Newline-separated string list of all changed files |

## Configuration File Format

The action expects a JSON configuration file with the following structure:

```json
{
  "packages": [
    {
      "packagePath": "components/my-component",
      "targetRepo": "owner/my-component"
    },
    {
      "packagePath": "packages/core/my-package",
      "targetRepo": "owner/my-package"
    }
  ]
}
```

## Usage Examples

### Basic Usage

```yaml
- name: Detect changed packages
  id: detect
  uses: arcmantle/github-actions/detect-changes@main
```

### With Custom Configuration File

```yaml
- name: Detect changed packages
  id: detect
  uses: arcmantle/github-actions/detect-changes@main
  with:
    config-file: '.github/custom-sync.json'
```

### With Explicit Refs (Push Event)

```yaml
- name: Detect changed packages
  id: detect
  uses: arcmantle/github-actions/detect-changes@main
  with:
    base-ref: ${{ github.event.before }}
    head-ref: ${{ github.sha }}
```

### With Explicit Refs (Pull Request)

```yaml
- name: Detect changed packages
  id: detect
  uses: arcmantle/github-actions/detect-changes@main
  with:
    base-ref: ${{ github.event.pull_request.base.sha }}
    head-ref: ${{ github.event.pull_request.head.sha }}
```

### Complete Workflow Example

```yaml
name: Sync Packages

on:
  push:
    branches: [main]

jobs:
  detect:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.detect.outputs.matrix }}
      has-changes: ${{ steps.detect.outputs.has-changes }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Fetch full history for accurate diffs

      - name: Detect changed packages
        id: detect
        uses: arcmantle/github-actions/detect-changes@main
        with:
          base-ref: ${{ github.event.before }}
          head-ref: ${{ github.sha }}

      - name: Show results
        run: |
          echo "Has changes: ${{ steps.detect.outputs.has-changes }}"
          echo "Matrix: ${{ steps.detect.outputs.matrix }}"

  sync:
    needs: detect
    if: needs.detect.outputs.has-changes == 'true'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: ${{ fromJson(needs.detect.outputs.matrix) }}
    steps:
      - name: Sync package
        run: |
          echo "Syncing ${{ matrix.package.targetRepo }}"
          echo "From: ${{ matrix.package.packagePath }}"
```

## How It Works

1. **Read Inputs**: `main.ts` reads `config-file`, `base-ref`, and `head-ref` from GitHub Actions inputs
2. **Determine Base Reference**: If `base-ref` is provided and exists, use it; otherwise fall back to `HEAD~1`. Handles the special case of null commits (`0000000000000000000000000000000000000000`)
3. **Get Changed Files**: Executes `git diff --name-only` between the base and head references
4. **Load Configuration**: Reads and parses the JSON configuration file, validating its structure
5. **Match Packages**: For each package in the config, checks if any changed files start with `packagePath + '/'`
6. **Return Results**: The `detectChanges()` function returns an object with `matrix`, `hasChanges`, and `changedFiles`
7. **Set Outputs**: `main.ts` logs the results and sets GitHub Actions outputs

## Requirements

- Git repository with commit history
- Valid JSON configuration file at the specified path
- Node.js 24 runtime (as specified in `action.yml`)

## Error Handling

The action will fail (`core.setFailed()`) if:

- The configuration file doesn't exist at the specified path
- The configuration file contains invalid JSON
- An unexpected error occurs during processing

The action gracefully handles:

- Force pushes (missing base commits) - Falls back to `HEAD~1`
- Null commit refs (`0000000000000000000000000000000000000000`) - Falls back to `HEAD~1`
- Empty or missing `base-ref` input - Falls back to `HEAD~1`
- Invalid package entries (missing `packagePath` or `targetRepo`) - Skips them silently
- Git commands that fail - Returns empty string from `executeGitCommand()`

# Replace Dependencies Action

A GitHub Action that updates `package.json` dependencies based on a provided dependency map.

## Description

This action takes a JSON dependency map and updates the corresponding dependencies in a `package.json` file. It's useful for automating dependency updates across multiple packages in a monorepo or when coordinating version updates between related packages.

## Inputs

### `dep-map` (required)

A JSON object mapping package names to their dependencies and versions.

**Format:**

```typescript
type DependencyMap = Record<string, Record<string, string>>;
```

**Example:**

```json
{
  "@arcmantle/my-package": {
    "@arcmantle/core": "^1.2.3",
    "lodash": "^4.17.21"
  }
}
```

### `package-json-path` (optional)

Path to the `package.json` file to update.

- **Default:** `package.json`
- **Required:** No

## Outputs

### `updated`

Boolean string (`"true"` or `"false"`) indicating whether any dependencies were updated.

### `changes`

JSON array of changes made, with each change containing:

- `dependency`: The name of the dependency
- `section`: The section where it was found (e.g., `dependencies`, `devDependencies`)
- `oldVersion`: The previous version
- `newVersion`: The new version

## Usage

### Basic Example

```yaml
- name: Update dependencies
  uses: arcmantle/github-actions/replace-deps@main
  with:
    dep-map: '{"@arcmantle/my-package": {"@arcmantle/core": "^1.2.3"}}'
```

### With Custom Package Path

```yaml
- name: Update dependencies
  uses: arcmantle/github-actions/replace-deps@main
  with:
    dep-map: ${{ steps.resolve-deps.outputs.dep-map }}
    package-json-path: './packages/my-package/package.json'
```

### Using with pnpm-to-semver Action

```yaml
- name: Resolve workspace dependencies
  id: resolve-deps
  uses: arcmantle/github-actions/pnpm-to-semver@main

- name: Update dependencies
  uses: arcmantle/github-actions/replace-deps@main
  with:
    dep-map: ${{ steps.resolve-deps.outputs.dep-map }}
```

### Checking for Changes

```yaml
- name: Update dependencies
  id: update-deps
  uses: arcmantle/github-actions/replace-deps@main
  with:
    dep-map: ${{ steps.resolve-deps.outputs.dep-map }}

- name: Commit changes
  if: steps.update-deps.outputs.updated == 'true'
  run: |
    git add package.json
    git commit -m "chore: update dependencies"
```

## How It Works

1. Reads the `package.json` file at the specified path
2. Parses the provided dependency map
3. Finds dependencies in the package that match entries in the map
4. Updates versions in `dependencies`, `devDependencies`, `peerDependencies`, or `optionalDependencies`
5. Writes the updated `package.json` back to disk (only if changes were made)
6. Returns information about what was updated

## Features

- ✅ Updates all dependency sections (dependencies, devDependencies, peerDependencies, optionalDependencies)
- ✅ Only updates dependencies that already exist in the package.json
- ✅ Preserves package.json formatting with 2-space indentation
- ✅ Provides detailed logging of all changes
- ✅ Skips packages that have no matching dependencies

## Error Handling

The action will fail if:

- The `package.json` file doesn't exist at the specified path
- The `package.json` file contains invalid JSON
- The `dep-map` input is not valid JSON
- File write permissions are insufficient

## License

MIT

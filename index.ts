import { CLIEngine } from 'eslint'
import { Plugin } from 'vite'
import * as pm from 'picomatch'
import * as path from 'path'

function normalizePath (filePath: string) {
  return filePath.split(path.win32.sep).join(path.posix.sep)
}

function relativePath (filePath: string) {
  return path.relative(process.cwd(), filePath)
    .split(path.sep)
    .join('/')
}

type FilterPattern = ReadonlyArray<string | RegExp> | string | RegExp | null

function ensureArray (thing: FilterPattern | undefined) {
  if (Array.isArray(thing)) return thing
  if (thing == null) return []
  return [thing]
}

interface Options extends CLIEngine.Options {
  include?: string[] | string
  exclude?: string[] | string
}

function createFilter (include?: FilterPattern, exclude?: FilterPattern) {
  const getMatcher = (id: any) => id instanceof RegExp
    ? id
    : {
        test: (what: any) => {
          const fn = pm(id, { dot: true })
          return fn(what)
        }
      }
  const includeMatchers = ensureArray(include).map(getMatcher)
  const excludeMatchers = ensureArray(exclude).map(getMatcher)
  return function result (id: any) {
    if (typeof id !== 'string') return false
    const pathId = normalizePath(id)
    for (let i = 0; i < excludeMatchers.length; ++i) {
      const matcher = excludeMatchers[i]
      if (matcher.test(pathId)) { return false }
    }
    for (let i = 0; i < includeMatchers.length; ++i) {
      const matcher = includeMatchers[i]
      if (matcher.test(pathId)) { return true }
    }
    return !includeMatchers.length
  }
}

export default function eslintPlugin (
  options?: Options
): Plugin {
  const cli = new CLIEngine(options || {})
  const formatter = cli.getFormatter('stylish')
  const filter = createFilter(options?.include || [], options?.exclude || /node_modules/)
  return {
    name: 'eslint',
    transform (code, id) {
      if (filter(relativePath(id))) {
        const report = cli.executeOnFiles([id])
        if (report.warningCount === 0 && report.errorCount === 0) {
          return null
        }
        const result = formatter(report.results)
        if (result) {
          console.log(result)
        }
      }
      return null
    }
  }
}

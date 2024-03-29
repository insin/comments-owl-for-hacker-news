const fs = require('fs')

const semver = require('semver')

const contentPath = './content.js'
const manifestV2Path = './manifest.json'
const manifestV3Path = './safari/Shared (Extension)/Resources/manifest.json'
const safariProjectPath = './safari/Comments Owl for Hacker News.xcodeproj/project.pbxproj'

let releaseType = process.argv[2]

if (!releaseType) {
  console.log(`
Usage:
  npm run release (patch|minor|major)
`.trim())
  process.exit(1)
}

let currentVersion = JSON.parse(fs.readFileSync(manifestV2Path, {encoding: 'utf8'})).version
let nextVersion = semver.inc(currentVersion, releaseType)

fs.writeFileSync(
  contentPath,
  fs.readFileSync(contentPath, {encoding: 'utf8'})
    .replace(/@version     (\d+)/g, (_, current) => `@version     ${Number(current) + 1}`),
  {encoding: 'utf8'}
)

for (let manifestPath of [manifestV2Path, manifestV3Path]) {
  fs.writeFileSync(
    manifestPath,
    fs.readFileSync(manifestPath, {encoding: 'utf8'})
      .replace(/"version": "[^"]+"/, `"version": "${nextVersion}"`),
    {encoding: 'utf8'}
  )
}

fs.writeFileSync(
  safariProjectPath,
  fs.readFileSync(safariProjectPath, {encoding: 'utf8'})
    .replace(/CURRENT_PROJECT_VERSION = (\d+)/g, (_, current) => `CURRENT_PROJECT_VERSION = ${Number(current) + 1}`)
    .replace(/MARKETING_VERSION = [^;]+/g, `MARKETING_VERSION = ${nextVersion}`),
  {encoding: 'utf8'}
)

console.log(`Bumped to v${nextVersion}`)
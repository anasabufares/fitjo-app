$ErrorActionPreference = "Stop"

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) {
  $nodePath = $nodeCommand.Source
} else {
  $bundledNode = Join-Path $HOME ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  if (-not (Test-Path -LiteralPath $bundledNode)) {
    throw "Node.js was not found. Install Node.js, then run this setup again."
  }
  $nodePath = $bundledNode
}

& $nodePath (Join-Path $PSScriptRoot "configure-admin.mjs")
exit $LASTEXITCODE

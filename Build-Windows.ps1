param([switch]$Install)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
Write-Host 'ForgeLabs BeatScope - Windows build (csak sajat felhasznalo)' -ForegroundColor Cyan

# A forrasmappanak irhatonak kell lennie; semmit sem teszunk a Program Files-ba.
$writeProbe = Join-Path $PSScriptRoot ('.forgelabs-write-test-' + [guid]::NewGuid().ToString('N'))
try {
  [System.IO.File]::WriteAllText($writeProbe, 'OK')
} catch {
  throw 'A projektmappa nem irhato. Csomagold ki a ZIP-et a Dokumentumok vagy Letoltesek mappadba (ne a Program Files mappaba).'
} finally {
  Remove-Item -LiteralPath $writeProbe -Force -ErrorAction SilentlyContinue
}

# A regi script csak a PATH-on kereste a Node-ot. Az uj verzio a gyakori
# telepitesi helyeket es a korabban letoltott hordozhato valtozatokat is vizsgalja.
$nodeDirs = New-Object 'System.Collections.Generic.List[string]'
function Add-NodeCandidate {
  param([string]$Dir)
  if (-not [string]::IsNullOrWhiteSpace($Dir)) {
    $nodeDirs.Add($Dir)
  }
}

foreach ($name in @('node.exe', 'npm.cmd')) {
  foreach ($cmd in @(Get-Command $name -All -ErrorAction SilentlyContinue)) {
    if ($cmd -and $cmd.CommandType -eq 'Application') {
      Add-NodeCandidate (Split-Path -Parent $cmd.Source)
    }
  }
}

foreach ($value in @(
  $env:FORGELABS_NODE_DIR,
  $env:NVM_SYMLINK,
  $env:FNM_MULTISHELL_PATH,
  $env:NODE_HOME,
  $env:VOLTA_HOME
)) {
  Add-NodeCandidate $value
  if ($value -and (Split-Path -Leaf $value) -ne 'bin') {
    Add-NodeCandidate (Join-Path $value 'bin')
  }
}

if ($env:ProgramFiles) { Add-NodeCandidate (Join-Path $env:ProgramFiles 'nodejs') }
if (${env:ProgramFiles(x86)}) { Add-NodeCandidate (Join-Path ${env:ProgramFiles(x86)} 'nodejs') }
if ($env:LOCALAPPDATA) {
  Add-NodeCandidate (Join-Path $env:LOCALAPPDATA 'Programs\nodejs')
  Add-NodeCandidate (Join-Path $env:LOCALAPPDATA 'Programs\Node.js')
  Add-NodeCandidate (Join-Path $env:LOCALAPPDATA 'Volta\bin')
  Add-NodeCandidate (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links')
  Add-NodeCandidate (Join-Path $env:LOCALAPPDATA 'fnm')
  Add-NodeCandidate (Join-Path $env:LOCALAPPDATA 'Programs\Volta\bin')
}
if ($env:USERPROFILE) {
  Add-NodeCandidate (Join-Path $env:USERPROFILE 'scoop\apps\nodejs\current')
  Add-NodeCandidate (Join-Path $env:USERPROFILE 'scoop\apps\nodejs-lts\current')
  Add-NodeCandidate (Join-Path $env:USERPROFILE 'scoop\apps\nodejs22\current')
}

$nodeVersion = 'v24.11.1'
# A letoltes egy ALLANDO felhasznaloi cache-be kerul, nem a kicsomagolt ZIP mappajaba.
# Igy ha friss verziot uj konyvtarba csomagolsz, az elozoleg letoltott Node megmarad.
if ($env:LOCALAPPDATA) {
  $cacheRoot = Join-Path $env:LOCALAPPDATA 'ForgeLabs\BrowserTools'
} else {
  $cacheRoot = Join-Path $PSScriptRoot '.tools'
}
foreach ($root in @($cacheRoot, (Join-Path $PSScriptRoot '.tools'))) {
  if (Test-Path -LiteralPath $root -PathType Container) {
    foreach ($dir in @(Get-ChildItem -LiteralPath $root -Directory -Filter 'node-*-win-x64' -ErrorAction SilentlyContinue)) {
      Add-NodeCandidate $dir.FullName
    }
  }
}

# A 0.1.2 hordozhato Node-ja megmaradhat egy KORABBI letoltott projekt .tools mappajaban.
# Ezeket is megtalaljuk, hogy soha ne kelljen ugyanazt ujra letolteni.
if ($env:USERPROFILE) {
  $homeFolders = @((Join-Path $env:USERPROFILE 'Downloads'), (Join-Path $env:USERPROFILE 'Documents'))
  foreach ($homeFolder in $homeFolders) {
    if (-not (Test-Path -LiteralPath $homeFolder -PathType Container)) { continue }
    foreach ($oldProject in @(Get-ChildItem -LiteralPath $homeFolder -Directory -Filter '*ForgeLabs-Browser*' -ErrorAction SilentlyContinue)) {
      foreach ($oldRoot in @($oldProject.FullName, (Join-Path $oldProject.FullName 'ForgeLabs-Browser'))) {
        $legacyTools = Join-Path $oldRoot '.tools'
        if (Test-Path -LiteralPath $legacyTools -PathType Container) {
          foreach ($oldNode in @(Get-ChildItem -LiteralPath $legacyTools -Directory -Filter 'node-*-win-x64' -ErrorAction SilentlyContinue)) {
            Add-NodeCandidate $oldNode.FullName
          }
        }
      }
    }
  }
}

# Ne inditsuk az npm.cmd-ot: CMD-alapu shimek az ekezetes Windows
# felhasznaloi utvonalakon es szukitett PATH eseten elromolhatnak.
# A Node.js telepites resze az npm-cli.js, kozvetlenul node.exe-vel futtatjuk.
$script:nodeFailures = New-Object 'System.Collections.Generic.List[string]'
function Node-Failure {
  param([string]$Dir, [string]$Reason)
  $script:nodeFailures.Add("$Dir : $Reason")
}
function Test-NodeInstallation {
  param([string]$Dir)
  if (-not (Test-Path -LiteralPath $Dir -PathType Container)) { return $null }
  $exe = Join-Path $Dir 'node.exe'
  $npmCli = Join-Path $Dir 'node_modules\npm\bin\npm-cli.js'
  if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) {
    Node-Failure $Dir 'node.exe nem letezik'
    return $null
  }
  if (-not (Test-Path -LiteralPath $npmCli -PathType Leaf)) {
    Node-Failure $Dir 'node_modules\npm\bin\npm-cli.js nem letezik'
    return $null
  }
  # A hibat es stderr-t NEM nyeljuk el. Ha valamelyik exe-t a gep blokkolja,
  # az eredeti indok is kikerul a diagnosztikai logba.
  $oldErrorAction = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $nodeOutput = & $exe --version 2>&1
    $nodeCode = $LASTEXITCODE
    $nodeText = (($nodeOutput | Out-String).Trim())
    if ($nodeCode -ne 0) {
      Node-Failure $Dir "node.exe --version exit=$nodeCode : $nodeText"
      return $null
    }
    $nodeMatch = [regex]::Match($nodeText, '^v(\d+)\.')
    if (-not $nodeMatch.Success -or [int]$nodeMatch.Groups[1].Value -lt 20) {
      Node-Failure $Dir "Node verzio nem tamogatott / nem felismerheto: $nodeText"
      return $null
    }
    $oldPath = $env:Path
    try {
      $env:Path = "$Dir;$oldPath"
      $npmOutput = & $exe $npmCli --version 2>&1
      $npmCode = $LASTEXITCODE
      $npmText = (($npmOutput | Out-String).Trim())
      if ($npmCode -ne 0 -or $npmText -notmatch '(?m)^\s*\d+\.\d+') {
        Node-Failure $Dir "node.exe npm-cli.js --version exit=$npmCode : $npmText"
        return $null
      }
    } finally {
      $env:Path = $oldPath
    }
    return @{ Directory = $Dir; Node = $exe; NpmCli = $npmCli; Version = $nodeText }
  } catch {
    Node-Failure $Dir $_.Exception.Message
    return $null
  } finally {
    $ErrorActionPreference = $oldErrorAction
  }
}

function Show-NodeFailures {
  Write-Host 'Node.js/npm diagnosztika:' -ForegroundColor Yellow
  foreach ($failure in $script:nodeFailures | Select-Object -Unique) {
    Write-Host ('  ' + $failure) -ForegroundColor Yellow
  }
  $log = Join-Path $cacheRoot 'node-diagnostics.txt'
  New-Item -ItemType Directory -Path $cacheRoot -Force | Out-Null
  $script:nodeFailures | Select-Object -Unique | Set-Content -LiteralPath $log -Encoding UTF8
  Write-Host ("Hibajegyzes: " + $log) -ForegroundColor Cyan
}

$found = $null
foreach ($dir in @($nodeDirs | Select-Object -Unique)) {
  $found = Test-NodeInstallation $dir
  if ($found) { break }
}

if (-not $found) {
  $nodeDir = Join-Path $cacheRoot "node-$nodeVersion-win-x64"
  New-Item -ItemType Directory -Path $cacheRoot -Force | Out-Null
  $found = Test-NodeInstallation $nodeDir
  if (-not $found) {
    Write-Host 'Nem talaltam hasznalhato Node.js + npm parost sem a telepitett helyeken, sem a cache-ben.' -ForegroundColor Yellow
    Write-Host 'Egyszer letoltom a hordozhato Node.js-t a felhasznaloi cache-be. Adminjog nem kell.' -ForegroundColor Cyan
    $nodeZip = Join-Path $cacheRoot "node-$nodeVersion-win-x64.zip"
    # Meglevo ZIP-et is ujra lehet hasznalni, ha az elozo kibontas hibas volt.
    try {
      if (-not ((Test-Path -LiteralPath $nodeZip -PathType Leaf) -and ((Get-Item -LiteralPath $nodeZip).Length -gt 30000000))) {
        $tempZip = "$nodeZip.partial"
        Remove-Item -LiteralPath $tempZip -Force -ErrorAction SilentlyContinue
        Write-Host 'Hivatalos Node.js ZIP letoltese (csak most, ha tenyleg nincs sehol).' -ForegroundColor Yellow
        Invoke-WebRequest -UseBasicParsing -Uri "https://nodejs.org/dist/$nodeVersion/node-$nodeVersion-win-x64.zip" -OutFile $tempZip
        if ((Get-Item -LiteralPath $tempZip).Length -lt 30000000) { throw 'Letoltes tul rovid: a ZIP valoszinuleg nem teljes.' }
        Move-Item -LiteralPath $tempZip -Destination $nodeZip -Force
      } else {
        Write-Host 'A mar letoltott Node.js ZIP ujrafelhasznalasa...' -ForegroundColor Green
      }
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      $archive = [System.IO.Compression.ZipFile]::OpenRead($nodeZip)
      try {
        $expectedExe = "node-$nodeVersion-win-x64/node.exe"
        $expectedNpm = "node-$nodeVersion-win-x64/node_modules/npm/bin/npm-cli.js"
        if (-not ($archive.GetEntry($expectedExe) -and $archive.GetEntry($expectedNpm))) {
          throw 'A letoltott ZIP-ben hianyzik a node.exe vagy az npm-cli.js. A cache-elt ZIP-et torold, majd probald ujra.'
        }
      } finally { $archive.Dispose() }
      Expand-Archive -LiteralPath $nodeZip -DestinationPath $cacheRoot -Force
    } catch {
      Write-Host ('Node.js kibontas/letoltes reszletes hibaja: ' + $_.Exception.Message) -ForegroundColor Red
      throw
    }
    $found = Test-NodeInstallation $nodeDir
    if (-not $found) {
      Show-NodeFailures
      Write-Host 'A kicsomagolt Node.js vagy npm nem indul. A fenti diagnosztika megmutatja a pontos hibauzenetet.' -ForegroundColor Red
      throw 'A kicsomagolt Node.js nem hasznalhato. Ne probald megkerulni a gep biztonsagi szabalyait; ha blokkolt, keresd az uzemeltetot.'
    }
  }
}

# MINDEN tovabbi lepes ugyanazt a mukodo Node/npm valtozatot hasznalja.
$env:Path = "$($found.Directory);$env:Path"
Write-Host ("Meglevo Node.js hasznalata: " + $found.Version + " (" + $found.Directory + ")") -ForegroundColor Green
$nodeExe = $found.Node
$npmCli = $found.NpmCli
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
if (-not (Test-Path 'node_modules/electron')) {
  Write-Host 'Electron es build fuggosegek ellenorzese / npm install...' -ForegroundColor Cyan
  & $nodeExe $npmCli install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'npm install sikertelen' }
}
Write-Host 'Forraskod ellenorzese...' -ForegroundColor Cyan
& $nodeExe $npmCli run check
if ($LASTEXITCODE -ne 0) { throw 'Teszthiba' }
Write-Host 'Windows installer es hordozhato .exe keszitese...' -ForegroundColor Cyan
& $nodeExe $npmCli run dist:win
if ($LASTEXITCODE -ne 0) { throw 'Windows build hiba' }
Write-Host 'Keszen van! A dist mappaban kulon telepito es portable exe van.' -ForegroundColor Green
if ($Install) {
  $installer = Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'dist') -File -Filter 'ForgeLabs-BeatScope-Setup-*.exe' |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $installer) { throw 'Nem talaltam a felhasznaloi telepitot a dist mappaban.' }
  Write-Host 'Felhasznaloi telepito inditasa. NEM kerhet rendszergazdai jogot.' -ForegroundColor Cyan
  Write-Host 'Cel: a sajat %LOCALAPPDATA%\Programs\ForgeLabs BeatScope mappa.'
  $proc = Start-Process -FilePath $installer.FullName -PassThru -Wait
  if ($proc.ExitCode -ne 0) { throw ('A telepito hibaval kilepett: ' + $proc.ExitCode) }
  Write-Host 'Telepites befejezodott.' -ForegroundColor Green
}
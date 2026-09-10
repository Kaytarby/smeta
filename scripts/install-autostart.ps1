$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$cmd = Join-Path $root "start.cmd"
$taskName = "Operplan"

if (-not (Test-Path $cmd)) {
  throw "Не найден $cmd"
}

schtasks /Create /TN $taskName /TR "`"$cmd`"" /SC ONLOGON /F /RL LIMITED | Out-Null
Write-Host "Автозапуск включён: задача $taskName при входе в Windows."
Write-Host "Программа стартует на этом ноутбуке. Пока он выключен, база недоступна."
Write-Host "Коллегам нужен адрес из окна программы, например http://192.168.x.x:3000"

$addFw = Read-Host "Открыть порт 3000 в брандмауэре Windows для локальной сети? (нужны права администратора) [y/N]"
if ($addFw -match '^[yYдД]') {
  netsh advfirewall firewall add rule name="Operplan 3000" dir=in action=allow protocol=TCP localport=3000 profile=private,domain
}

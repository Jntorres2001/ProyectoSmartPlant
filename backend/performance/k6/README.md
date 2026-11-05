# Pruebas de rendimiento con k6

Estos scripts ejercitan la API HTTP existente; no modifican datos ni prueban el protocolo WebSocket.
Se alternan cinco endpoints GET, uno por iteración de cada usuario virtual:

| Endpoint | Motivo |
| --- | --- |
| `GET /api/health` | Referencia del servidor sin acceso a base de datos ni autenticación. |
| `GET /api/lecturas/actual` | Consulta usada por el panel principal; mide lectura desde MySQL. |
| `GET /api/lecturas/historial?pagina=1&limite=10` | Consulta paginada, acotada para evitar respuestas innecesariamente grandes. |
| `GET /api/alertas/resumen` | Consulta agregada para el resumen de alertas. |
| `GET /api/dispositivos` | Consulta de los dispositivos. |

Las rutas de lecturas, alertas y dispositivos requieren un JWT. El script aborta al iniciar si falta
`TOKEN`; no intenta iniciar sesión durante la medición. La mezcla de endpoints permanece igual en
cada nivel de carga. El tiempo de respuesta y p(95) se miden con las métricas HTTP de k6; la tasa de
errores es el porcentaje de comprobaciones que no recibieron HTTP 200. También se reportan el total
de solicitudes y solicitudes por segundo.

## Requisitos

- Backend SmartPlant en ejecución y conectado a su base MySQL.
- k6 instalado y disponible como `k6` en la terminal.
- Un JWT válido de un usuario activo de SmartPlant.

## Ejecutar en PowerShell

Desde la raíz del proyecto SmartPlant:

```powershell
Set-Location .\backend\performance\k6
$env:BASE_URL = "http://localhost:3000"
$correo = Read-Host "Correo de SmartPlant"
$password = Read-Host "Contraseña" -AsSecureString
$passwordTexto = [System.Net.NetworkCredential]::new("", $password).Password
$login = Invoke-RestMethod -Method Post -Uri "$env:BASE_URL/api/auth/login" -ContentType "application/json" -Body (@{ correo = $correo; password = $passwordTexto } | ConvertTo-Json)
$env:TOKEN = $login.token
Remove-Variable passwordTexto, password
```

Pasa las variables explícitamente a k6 con `--env`:

```powershell
function Invoke-K6LoadTest {
  k6 run `
    --env "BASE_URL=$env:BASE_URL" `
    --env "TOKEN=$env:TOKEN" `
    --env "VUS=$env:VUS" `
    --env "RAMP_UP=$env:RAMP_UP" `
    --env "DURATION=$env:DURATION" `
    --env "RAMP_DOWN=$env:RAMP_DOWN" `
    --env "SUMMARY_FILE=$env:SUMMARY_FILE" `
    .\load-test.js
}
```

Ejecuta cada nivel como una prueba independiente. El tiempo total por ejecución es la suma de
`RAMP_UP`, `DURATION` y `RAMP_DOWN`. Ajusta los niveles de VUs/duración según la capacidad del
entorno; los valores siguientes son ejemplos de configuración, no resultados esperados:

```powershell
$env:VUS = "10"
$env:RAMP_UP = "15s"
$env:DURATION = "1m"
$env:RAMP_DOWN = "10s"
$env:SUMMARY_FILE = "results\10-vus.json"
Invoke-K6LoadTest

$env:VUS = "25"
$env:SUMMARY_FILE = "results\25-vus.json"
Invoke-K6LoadTest

$env:VUS = "50"
$env:SUMMARY_FILE = "results\50-vus.json"
Invoke-K6LoadTest
```

Al finalizar, cada prueba imprime un resumen JSON y guarda el mismo resumen en `results`. Para
comparar el tiempo medio, p(95), tasa de errores, solicitudes por segundo y cantidad de solicitudes
entre los niveles ejecutados:

```powershell
node .\compare-results.js .\results\10-vus.json .\results\25-vus.json .\results\50-vus.json
```

Las métricas dependen del equipo, la base de datos, los datos disponibles y el entorno de ejecución;
se deben obtener corriendo las pruebas. No se configuran umbrales de aprobación arbitrarios.
Empieza con cargas bajas y no ejecutes pruebas de carga contra un sistema de producción sin
autorización.

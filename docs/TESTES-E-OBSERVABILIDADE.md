# Testes Automatizados e Observabilidade

Este documento descreve as implementações realizadas para atender aos requisitos de testes automatizados, evidências de execução e observabilidade do projeto.

## Índice

- [Item 4: Testes Automatizados](#item-4-testes-automatizados)
- [Item 5: Evidências de Execução dos Testes](#item-5-evidências-de-execução-dos-testes)
- [Item 9: Logs, Monitoramento e Observabilidade](#item-9-logs-monitoramento-e-observabilidade)

---

## Item 4: Testes Automatizados

### Meta Atingida

**Objetivo:** 100 testes (unitários, integração, E2E e performance)

**Resultado:** **125 testes** ✅

### Distribuição dos Testes

| Tipo | Quantidade | Localização |
|------|-----------|-------------|
| Unitários | 97 | `tests/unit/**/*.test.ts` |
| Integração | 10 | `tests/integracao/**/*.test.ts` |
| E2E | 11 | `tests/e2e/**/*.spec.ts` |
| Performance | 7 | `tests/performance/**/*.test.ts` |
| **Total** | **125** | |

### Testes Adicionados

#### 1. Testes E2E de Observabilidade

**Arquivo:** `tests/e2e/observabilidade.spec.ts`

Testes públicos que verificam os endpoints de observabilidade sem necessidade de autenticação:

```typescript
test("115 - /healthz retorna status ok e uptime")
test("116 - /metrics retorna agregado de requisições")
test("117 - /healthz e /metrics têm cache-control no-store")
```

**Execução:**
```bash
pnpm run test:e2e
```

#### 2. Testes Unitários do Server

**Arquivo:** `tests/unit/server.test.ts`

Testes que validam a funcionalidade de observabilidade integrada no servidor:

```typescript
test("118 - statusSaude sempre retorna ok com timestamp ISO")
test("119 - snapshotMetricas com requisições de sucesso e erro")
test("120 - snapshotMetricas rotas ordenadas por contagem")
test("121 - normalizarCaminho com UUID múltiplos")
test("122 - normalizarCaminho sem pathname usa /")
test("123 - normalizarCaminho com query string complexa")
test("124 - normalizarCaminho com caminho muito longo limita a 120 chars")
```

**Execução:**
```bash
pnpm run test
```

### Como Rodar os Testes

#### Testes Unitários e Integração

```bash
# Rodar todos os testes uma vez
pnpm run test

# Rodar em modo watch (reexecuta ao alterar arquivos)
pnpm run test:watch

# Rodar com cobertura de código
pnpm run test:coverage
```

#### Testes E2E

```bash
# Rodar testes E2E (sobe servidor dev automaticamente)
pnpm run test:e2e

# Rodar contra ambiente específico (Docker, preview, etc.)
E2E_BASE_URL=https://seu-dominio.com pnpm run test:e2e
```

#### Testes de Performance

```bash
# Os testes de performance são incluídos no `pnpm run test`
pnpm run test
```

### Estrutura dos Testes

```
tests/
├── unit/                    # Testes unitários (97 testes)
│   ├── backup-resumo.test.ts
│   ├── dominio-extra.test.ts
│   ├── email.test.ts
│   ├── error-capture.test.ts
│   ├── geo.test.ts
│   ├── lembrar.test.ts
│   ├── lovable-error.test.ts
│   ├── mensagem-erro-extra.test.ts
│   ├── observabilidade.test.ts
│   ├── setec-helpers.test.ts
│   ├── utils-error-page.test.ts
│   └── server.test.ts       # NOVO - testes do servidor
├── integracao/              # Testes de integração (10 testes)
│   ├── devolucoes.test.ts
│   ├── mensagem-e-storage-extra.test.ts
│   └── storage.test.ts
├── e2e/                     # Testes E2E (11 testes)
│   ├── apoio.ts
│   ├── login.spec.ts
│   ├── permissoes.spec.ts
│   ├── programacao.spec.ts
│   ├── publico.spec.ts
│   └── observabilidade.spec.ts  # NOVO - testes de observabilidade
└── performance/             # Testes de performance (7 testes)
    └── helpers.perf.test.ts
```

---

## Item 5: Evidências de Execução dos Testes

### Configuração no CI

As evidências dos testes são geradas automaticamente no GitHub Actions e publicadas como artefatos.

### Vitest (Unitários e Integração)

**Configuração:** `vitest.config.ts`

No CI, gera múltiplos formatos de relatório:

```typescript
reporters: process.env["CI"] ? ["default", "json", "junit"] : ["default"],
outputFile: {
  json: "test-results/vitest.json",
  junit: "test-results/vitest-junit.xml",
},
```

**Arquivos gerados:**
- `test-results/vitest.json` - Relatório em JSON
- `test-results/vitest-junit.xml` - Relatório compatível com JUnit
- `coverage/` - Diretório com relatórios de cobertura:
  - `index.html` - Relatório visual interativo
  - `coverage-summary.json` - Resumo em JSON
  - `lcov.info` - Formato LCOV para integração com ferramentas de CI

**Workflow CI:** `.github/workflows/ci.yml`

```yaml
- name: Testes automatizados com cobertura
  run: pnpm run test:coverage

- name: Publicar evidências dos testes
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: evidencias-testes
    path: |
      coverage/
      test-results/
    if-no-files-found: warn
    retention-days: 30
```

### Playwright (E2E)

**Configuração:** `playwright.config.ts`

```typescript
reporter: [
  ["list"],
  ["html", { open: "never", outputFolder: "playwright-report" }],
  ["junit", { outputFile: "test-results/playwright-junit.xml" }],
],
```

**Arquivos gerados:**
- `playwright-report/index.html` - Relatório HTML visual com screenshots e traces
- `test-results/playwright-junit.xml` - Relatório JUnit
- `test-results/` - Diretório com traces e screenshots (apenas em falhas)

**Workflow CI:** `.github/workflows/ci.yml`

Nova job dedicada para testes E2E:

```yaml
e2e:
  name: Testes E2E (Playwright)
  runs-on: ubuntu-latest
  timeout-minutes: 15
  steps:
    # ... setup ...
    - name: Rodar testes E2E
      run: pnpm run test:e2e
      env:
        E2E_BASE_URL: http://localhost:4173

    - name: Publicar evidências E2E
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: evidencias-e2e
        path: |
          playwright-report/
          test-results/
        if-no-files-found: warn
        retention-days: 30
```

### Acessando as Evidências

1. **No GitHub Actions:**
   - Vá até a execução do workflow
   - Na seção "Artifacts", baixe:
     - `evidencias-testes` - Contém coverage e relatórios Vitest
     - `evidencias-e2e` - Contém relatórios Playwright

2. **Localmente:**
   ```bash
   # Rodar testes com cobertura
   pnpm run test:coverage

   # Abrir relatório de cobertura
   open coverage/index.html

   # Rodar testes E2E
   pnpm run test:e2e

   # Abrir relatório E2E
   open playwright-report/index.html
   ```

### Retenção dos Artefatos

- **Período:** 30 dias
- **Configuração:** `retention-days: 30` no workflow
- **Disponibilidade:** Pode ser aumentado conforme necessidade

---

## Item 9: Logs, Monitoramento e Observabilidade

### Infraestrutura de Observabilidade

O projeto possui uma solução de observabilidade "in-repo" que não depende de serviços externos (Sentry, UptimeRobot, etc.), ideal para ambientes com restrições de infraestrutura.

### Implementação

**Arquivo principal:** `src/lib/observabilidade.ts`

#### 1. Logs Estruturados

Logs em formato JSON com metadados estruturados:

```typescript
export function logEvento(
  nivel: NivelLog,  // "info" | "warn" | "error"
  tipo: string,
  mensagem: string,
  dados?: Record<string, unknown>,
): EventoLog
```

**Exemplo de log gerado:**
```json
{
  "ts": "2026-11-04T10:30:00.000Z",
  "nivel": "error",
  "tipo": "http.request",
  "mensagem": "GET /painel",
  "dados": {
    "status": 500,
    "duracao_ms": 120
  }
}
```

**Níveis de log:**
- `info` - Informações gerais (console.info)
- `warn` - Avisos (console.warn)
- `error` - Erros (console.error, mantém em buffer)

#### 2. Métricas de Requisição

Registro automático de métricas HTTP:

```typescript
export function registrarRequisicao(m: MetricaRequisicao)
```

**Métricas coletadas:**
- Contagem total de requisições
- Contagem de erros (status >= 500)
- Duração média por requisição
- Taxa de erro
- Métricas por rota:
  - Requisições por rota
  - Erros por rota
  - Duração média por rota
  - Duração máxima por rota

#### 3. Endpoints de Monitoramento

**Arquivo:** `src/server.ts`

Dois endpoints públicos para monitoramento:

##### `/healthz` - Health Check

Retorna status de saúde do sistema:

```json
{
  "status": "ok",
  "ts": "2026-11-04T10:30:00.000Z",
  "uptime_s": 3600
}
```

**Uso:**
- Health checks automatizados (UptimeRobot, Better Stack, etc.)
- Load balancers
- Orquestradores (Kubernetes, Docker Swarm)

##### `/metrics` - Métricas Detalhadas

Retorna snapshot das métricas coletadas:

```json
{
  "ok": true,
  "uptime_s": 3600,
  "requisicoes": 150,
  "erros": 3,
  "taxa_erro": 0.02,
  "duracao_media_ms": 45,
  "rotas": [
    {
      "rota": "GET /painel",
      "requisicoes": 80,
      "erros": 2,
      "duracao_media_ms": 42,
      "duracao_max_ms": 120
    }
  ],
  "ultimos_erros": [
    {
      "ts": "2026-11-04T10:29:00.000Z",
      "nivel": "error",
      "tipo": "http.request",
      "mensagem": "GET /api falhou"
    }
  ]
}
```

**Uso:**
- Monitoramento de performance
- Análise de tendências
- Debug de problemas
- Dashboards de observabilidade

### Integração com Rotas

Os endpoints são integrados no servidor antes do routing da aplicação:

```typescript
// src/server.ts
function respostaObservabilidade(request: Request): Response | null {
  const caminho = normalizarCaminho(request.url);
  if (caminho === "/healthz") {
    return Response.json(statusSaude(), {
      headers: { "cache-control": "no-store" },
    });
  }
  if (caminho === "/metrics") {
    return Response.json(snapshotMetricas(), {
      headers: { "cache-control": "no-store" },
    });
  }
  return null;
}
```

### Normalização de Caminhos

UUIDs e tokens são normalizados para evitar explosão de cardinalidade nas métricas:

```typescript
export function normalizarCaminho(url: string): string {
  // /checkin/550e8400-e29b-41d4-a716-446655440000
  // vira /checkin/:id
}
```

### Monitoramento de Disponibilidade

#### No Docker

O Nginx também expõe `/healthz` para verificação externa:

**Arquivo:** `docker/frontend/nginx.conf.template`

```nginx
location = /healthz {
    access_log off;
    return 200 "healthy\n";
    add_header Content-Type text/plain;
}
```

#### Scripts de Verificação

**Bash:** `scripts/docker/verify.sh`
```bash
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/healthz")
[ "$code" = "200" ] && ok "/healthz -> 200" || falha "/healthz -> $code"
```

**PowerShell:** `scripts/docker/verify.ps1`
```powershell
$r = Get-Http "$BaseUrl/healthz"
if ($r.StatusCode -eq 200) { Ok "/healthz -> 200" } else { Falha "/healthz -> $($r.StatusCode)" }
```

### Testes de Observabilidade

#### Testes E2E

**Arquivo:** `tests/e2e/observabilidade.spec.ts`

Verifica que os endpoints funcionam corretamente:

```typescript
test("115 - /healthz retorna status ok e uptime")
test("116 - /metrics retorna agregado de requisições")
test("117 - /healthz e /metrics têm cache-control no-store")
```

#### Testes Unitários

**Arquivo:** `tests/unit/server.test.ts`

Valida a lógica de observabilidade:

```typescript
test("118 - statusSaude sempre retorna ok com timestamp ISO")
test("119 - snapshotMetricas com requisições de sucesso e erro")
test("120 - snapshotMetricas rotas ordenadas por contagem")
// ... outros testes
```

### Como Monitorar

#### 1. Health Check Manual

```bash
# Verificar se o servidor está saudável
curl https://seu-dominio.com/healthz

# Resposta esperada:
# {"status":"ok","ts":"2026-11-04T10:30:00.000Z","uptime_s":3600}
```

#### 2. Métricas em Tempo Real

```bash
# Obter métricas detalhadas
curl https://seu-dominio.com/metrics

# Formatar com jq para leitura
curl https://seu-dominio.com/metrics | jq
```

#### 3. Monitoramento Automatizado

Configure ferramentas externas para monitorar `/healthz`:

**UptimeRobot:**
- URL: `https://seu-dominio.com/healthz`
- Esperado: Status 200
- Intervalo: 5 minutos

**Better Stack:**
- Endpoint HTTP: `https://seu-dominio.com/healthz`
- Alertas: Se status != 200

**Kubernetes Liveness/Readiness:**
```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 80
  initialDelaySeconds: 30
  periodSeconds: 10
```

### Logs de Erros

Os últimos 50 erros são mantidos em memória e disponíveis em `/metrics`:

```json
{
  "ultimos_erros": [
    {
      "ts": "2026-11-04T10:29:00.000Z",
      "nivel": "error",
      "tipo": "http.request",
      "mensagem": "GET /api falhou",
      "dados": {
        "status": 500,
        "duracao_ms": 120
      }
    }
  ]
}
```

### Performance e Capacidade

A implementação é leve e não impacta a performance:

- **Memória:** Buffer circular de 50 erros (~5KB)
- **CPU:** Operações O(1) para registro de métricas
- **I/O:** Nenhum disco/banco de dados - tudo em memória
- **Normalização:** Caminhos limitados a 120 caracteres

### Limitações Conhecidas

1. **Dados voláteis:** Métricas são perdidas ao reiniciar o servidor
2. **Memória:** Apenas últimos 50 erros são mantidos
3. **Histórico:** Não há persistência de métricas ao longo do tempo
4. **Aggregação:** Não há granularidade temporal (minuto, hora, dia)

### Evolução Futura

Para ambientes de produção com maiores requisitos, considerar:

1. **Persistência:** Gravar métricas em banco de dados (TimescaleDB, InfluxDB)
2. **Aggregação temporal:** Rollups por minuto/hora/dia
3. **Distribuição:** Métricas centralizadas (Prometheus, Grafana)
4. **Alertas:** Integração com sistemas de alerta (PagerDuty, Opsgenie)
5. **Tracing:** Distributed tracing (OpenTelemetry, Jaeger)

---

## Resumo Executivo

### O que foi implementado

| Item | Status | Detalhes |
|------|--------|----------|
| **4. Testes** | ✅ 125 testes | 97 unitários, 10 integração, 11 E2E, 7 performance |
| **5. Evidências** | ✅ CI automatizado | Relatórios JSON, JUnit, HTML, cobertura de código |
| **9. Observabilidade** | ✅ In-repo | `/healthz`, `/metrics`, logs estruturados, monitoramento |

### Arquivos Criados/Modificados

**Novos arquivos:**
- `tests/e2e/observabilidade.spec.ts` - Testes E2E de observabilidade
- `tests/unit/server.test.ts` - Testes unitários do servidor
- `docs/TESTES-E-OBSERVABILIDADE.md` - Este documento

**Arquivos modificados:**
- `.github/workflows/ci.yml` - Adicionada job E2E e publicação de evidências
- `playwright.config.ts` - Adicionado reporter JUnit para CI
- `vitest.config.ts` - Já configurado para gerar evidências (sem alterações)
- `src/server.ts` - Já implementava observabilidade (sem alterações)
- `src/lib/observabilidade.ts` - Já implementava observabilidade (sem alterações)

### Próximos Passos Sugeridos

1. **Rodar os testes localmente:**
   ```bash
   pnpm run test:coverage
   pnpm run test:e2e
   ```

2. **Verificar evidências no CI:**
   - Fazer um push para o repositório
   - Acessar a execução do workflow no GitHub Actions
   - Baixar os artefatos `evidencias-testes` e `evidencias-e2e`

3. **Configurar monitoramento externo:**
   - Adicionar URL `/healthz` ao UptimeRobot ou similar
   - Configurar alertas para status != 200

4. **Revisar cobertura de código:**
   - Abrir `coverage/index.html` após rodar `pnpm run test:coverage`
   - Identificar áreas com baixa cobertura
   - Adicionar testes se necessário

---

## Documentação Relacionada

- [DEPLOY-DOCKER.md](./DEPLOY-DOCKER.md) - Deploy com Docker e Nginx
- [README.md](../README.md) - Visão geral do projeto
- [AGENTS.md](../AGENTS.md) - Regras para agentes de IA

## Suporte

Para dúvidas ou problemas com testes e observabilidade:

1. Verificar logs do servidor
2. Rodar testes localmente com `pnpm run test:watch`
3. Consultar relatórios de cobertura em `coverage/index.html`
4. Revisar evidências no GitHub Actions

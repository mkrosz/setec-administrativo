<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Testes e Observabilidade

O projeto possui 125 testes automatizados (unitários, integração, E2E e performance).

- **Documentação completa:** [docs/TESTES-E-OBSERVABILIDADE.md](docs/TESTES-E-OBSERVABILIDADE.md)
- **Rodar testes unitários:** `pnpm run test`
- **Rodar testes com cobertura:** `pnpm run test:coverage`
- **Rodar testes E2E:** `pnpm run test:e2e`

### Endpoints de Observabilidade

- `GET /healthz` - Health check para monitoramento de disponibilidade
- `GET /metrics` - Métricas detalhadas de requisições e erros

Implementação em `src/lib/observabilidade.ts` e `src/server.ts`.

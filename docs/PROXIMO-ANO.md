# O que o próximo ano pode implementar

Este documento é para a turma que assumir o painel da SETEC no próximo ano. Ele
resume o estado atual do projeto, sugere funcionalidades novas, lista as dívidas
técnicas conhecidas e registra o que aprendemos no caminho.

## Sumário

- [Onde o projeto está hoje](#onde-o-projeto-está-hoje)
- [Funcionalidades sugeridas](#funcionalidades-sugeridas)
- [Dívidas técnicas](#dívidas-técnicas)
- [DevOps e infraestrutura](#devops-e-infraestrutura)
- [Lições aprendidas](#lições-aprendidas)
- [Por onde começar](#por-onde-começar)

## Onde o projeto está hoje

| Área            | Situação                                                                                           |
| --------------- | -------------------------------------------------------------------------------------------------- |
| Aplicação       | Painel administrativo (TanStack Start + Supabase) e site público em repositório separado           |
| Funcionalidades | Programação, minicursos com inscrição, apoiadores, comissão, presença por QR Code, sorteio, backup |
| Testes          | 134 testes automatizados (unitários, integração, E2E e performance)                                |
| CI              | GitHub Actions com lint, tipos, testes, E2E, build e auditoria de dependências                     |
| CD              | Deploy automático na Vercel, imagens Docker no GitHub Container Registry, verificação pós-deploy   |
| Observabilidade | Logs em JSON, `/healthz` e `/metrics`                                                              |
| Documentação    | README, `CONTRIBUTING.md`, `docs/DEPLOY-DOCKER.md`, `docs/TESTES-E-OBSERVABILIDADE.md`             |

## Funcionalidades sugeridas

Em ordem de impacto para o evento. A coluna **Esforço** é uma estimativa para
um grupo de 4 a 5 pessoas.

| #   | Funcionalidade                          | Por quê                                                                                                                                            | Esforço |
| --- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | **Certificados automáticos**            | Gerar o certificado em PDF a partir da presença e enviar por e-mail, com código de verificação no site público. Hoje isso é feito à mão.           | Médio   |
| 2   | **Inscrição em palestras com vagas**    | As palestras não têm limite de lugares. Reaproveitar a lógica dos minicursos, com lista de espera.                                                 | Médio   |
| 3   | **Avaliação das palestras**             | Depois do check-in, o aluno dá nota de 1 a 5 e um comentário. O palestrante recebe o resultado.                                                    | Baixo   |
| 4   | **Painel de estatísticas**              | Presença por curso, turma e horário, comparação entre anos e taxa de comparecimento dos inscritos.                                                 | Médio   |
| 5   | **Sorteio com histórico no banco**      | Hoje o andamento fica só no navegador de quem sorteia. Salvar no Supabase, cadastrar prêmios e exibir o resultado em tempo real numa tela pública. | Baixo   |
| 6   | **Check-in sem digitar RA**             | Login com a conta institucional (Microsoft do Centro Paula Souza) ou QR Code individual do aluno, evitando presença em nome de outra pessoa.       | Alto    |
| 7   | **Lembretes antes das palestras**       | E-mail (ou WhatsApp) para os inscritos no dia anterior e uma hora antes.                                                                           | Baixo   |
| 8   | **Check-in que funciona com rede ruim** | Transformar a página de check-in em PWA: registrar offline e enviar quando a conexão voltar.                                                       | Alto    |
| 9   | **Área do palestrante**                 | Link para o palestrante enviar foto, bio e slides, sem a comissão digitar tudo.                                                                    | Médio   |
| 10  | **Acessibilidade**                      | Auditoria WCAG 2.1 AA do painel e do site público (contraste, teclado, leitores de tela).                                                          | Baixo   |

## Dívidas técnicas

Pontos que já sabemos que precisam de atenção:

1. **Tipos do Supabase desatualizados.** As tabelas criadas pelos scripts de
   `supabase/sql/` não estão em `src/integrations/supabase/types.ts`, por isso o
   código usa `as any` e o lint mostra cerca de 90 avisos `no-explicit-any`.
   Gerar os tipos com `supabase gen types` resolve.
2. **Vulnerabilidades em dependências.** O `pnpm audit` aponta 9 vulnerabilidades
   em bibliotecas de terceiros (1 crítica e 3 altas). A verificação no CI é só
   informativa; atualizar as dependências e torná-la obrigatória.
3. **Banco sem migrations versionadas.** As mudanças estão em scripts soltos em
   `supabase/sql/` que precisam ser rodados à mão, na ordem certa. Migrar para
   `supabase/migrations` e aplicar pela pipeline.
4. **Teste de carga real.** Os testes de performance medem funções internas.
   Falta um teste de carga (k6) contra um ambiente de preview, medindo latência,
   volume e erros do servidor.
5. **E2E com login fora do CI.** Os 6 testes E2E que fazem login precisam de um
   projeto Supabase de teste e de contas de teste configuradas como secrets.
6. **Logos hospedadas no Lovable.** As imagens do logotipo ficam em
   `/__l5e/...`, um servidor do Lovable (o projeto nasceu de um template dele).
   Mover para `public/` ou para o Supabase Storage.
7. **APIs depreciadas.** `createServerFn().inputValidator()` está depreciado no
   TanStack Start; trocar por `.validator()`.

## DevOps e infraestrutura

- **Domínio próprio.** A produção está em `setecfatecadmin.vercel.app`. Um domínio
  da SETEC (ou um subdomínio da FATEC) deixa o endereço mais fácil de divulgar.
- **CI obrigatório na `main`.** A proteção da branch exige revisão, mas não exige
  o CI verde. Marcar os jobs do CI como _required status checks_.
- **Dependabot ou Renovate** para atualizar dependências automaticamente.
- **Monitoramento externo:** UptimeRobot (ou similar) chamando `/healthz` e Sentry
  para capturar erros do navegador e do servidor.
- **Ambiente de homologação:** um projeto Supabase separado para testes, para
  ninguém testar em cima dos dados reais do evento.

## Lições aprendidas

- **Configure o Git antes do primeiro commit.** Um e-mail errado no
  `git config user.email` faz o GitHub creditar os commits a outra pessoa, e a
  única correção é reescrever o histórico. Use o e-mail _no-reply_ da sua conta
  (GitHub → Settings → Emails).
- **Um Pull Request por tarefa, ligado a uma issue.** PRs pequenos, com o template
  preenchido e `Closes #N`, são mais fáceis de revisar e deixam o histórico claro.
- **Revisão de verdade.** A aprovação deve vir de outra pessoa do grupo, que roda
  o projeto ou pelo menos lê a mudança.
- **Testes e CI desde o começo.** Colocar CI num projeto pronto exigiu formatar
  mais de 40 arquivos de uma vez; com o CI desde o início, isso não acontece.
- **Segredos nunca no repositório.** Use o `.env` (fora do Git) e o
  `.env.example` só com os nomes das variáveis.

## Por onde começar

1. Leia o `README.md` e o `CONTRIBUTING.md`.
2. Peça acesso ao repositório, à Vercel e ao Supabase para um integrante da
   turma anterior.
3. Rode o projeto localmente (`pnpm install`, `pnpm dev`) e os testes (`pnpm test`).
4. Resolva primeiro as dívidas 1 e 2: elas facilitam todo o resto.
5. Escolha as funcionalidades da tabela acima, abra uma issue para cada uma e
   siga o fluxo de branches e Pull Requests do `CONTRIBUTING.md`.

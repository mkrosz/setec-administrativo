# Como contribuir

Guia de desenvolvimento colaborativo do **SETEC — Painel Administrativo**.
Todo o time segue o mesmo fluxo para que o histórico fique limpo e a `main`
esteja sempre funcionando (ela sincroniza com o Lovable).

## 1. Preparar o ambiente

```bash
git clone https://github.com/mkrosz/setec-administrativo.git
cd setec-administrativo
pnpm install
cp .env.example .env   # preencha com as chaves do Supabase (peça a um admin)
pnpm dev
```

Configure sua identidade no Git (apenas uma vez por máquina ou por repositório):

```bash
git config user.name "Seu Nome"
git config user.email "seu-email-do-github@exemplo.com"
```

## 2. Fluxo de trabalho (GitHub Flow)

1. **Abra ou escolha uma issue** descrevendo o que será feito.
2. **Atualize a `main`**: `git checkout main && git pull`.
3. **Crie uma branch** a partir da `main`:

   | Tipo           | Padrão de nome            | Exemplo                       |
   | -------------- | ------------------------- | ----------------------------- |
   | Funcionalidade | `feat/<descricao-curta>`  | `feat/exportar-presencas`     |
   | Correção       | `fix/<descricao-curta>`   | `fix/qr-code-celular`         |
   | Documentação   | `docs/<descricao-curta>`  | `docs/guia-de-deploy`         |
   | Manutenção     | `chore/<descricao-curta>` | `chore/atualiza-dependencias` |

4. **Faça commits pequenos** seguindo o padrão abaixo.
5. **Envie a branch**: `git push -u origin <nome-da-branch>`.
6. **Abra um Pull Request** para a `main` e preencha o template.
7. **Peça revisão** de pelo menos um colega. Só faça merge após aprovação.
8. Após o merge, **apague a branch**.

> Nunca faça `git push --force` na `main` nem reescreva commits já enviados:
> isso apaga o histórico no Lovable.

## 3. Padrão de commits (Conventional Commits)

```
<tipo>: <descrição no imperativo, em minúsculas>
```

| Tipo       | Quando usar                                 |
| ---------- | ------------------------------------------- |
| `feat`     | Nova funcionalidade                         |
| `fix`      | Correção de bug                             |
| `docs`     | Apenas documentação                         |
| `style`    | Formatação, sem mudança de lógica           |
| `refactor` | Mudança de código sem alterar comportamento |
| `test`     | Adição ou ajuste de testes                  |
| `chore`    | Build, dependências, configurações          |
| `ci`       | Pipelines de integração contínua            |

Exemplos:

```
feat: adiciona filtro por dia na lista de palestras
fix: corrige leitura do qr code em celulares pequenos
docs: documenta variáveis de ambiente
```

## 4. Antes de abrir o Pull Request

```bash
pnpm lint
pnpm build
```

- O código compila e o lint passa sem erros.
- O CI (GitHub Actions) está verde no Pull Request.
- Nenhum dado sensível (`.env`, chaves, senhas) foi commitado.
- A mudança foi testada no navegador (desktop e celular, quando houver tela).

## 5. Revisão de código

- Comente de forma objetiva e respeitosa, sugerindo a alteração.
- Quem abriu o PR responde e resolve cada comentário.
- Conflitos com a `main` são resolvidos por quem abriu o PR.

# GiganteFinder — Radar de Pets Gigantes

Um **site novo, independente do EggHop**, para o jogo **Roube um Ovo (Steal an Egg)**, feito para celular e PC.

## O que funciona

- **Selecionar / digitar o pet:** procurar avistamentos recentes pelo nome. Nomes já relatados aparecem como sugestões.
- **Lista de servidores:** busca servidores públicos do Roblox, com jogadores, vagas e paginação.
- **Entrar:** botão que tenta abrir o aplicativo Roblox no Job ID selecionado.
- **Relatar avistamento:** jogadores podem enviar nome do pet + ID da sala + link opcional de prova. O relato fica disponível para todos por até 25 minutos, via Netlify Blobs.
- **Sem autorização:** não exige nick, login nem senha para usar o site.

**Limitação importante:** a API pública do Roblox **não revela quais pets estão em cada servidor**. Os relatos são enviados pelos usuários e marcados como **NÃO VERIFICADOS**. O site NÃO detecta gigantes sozinho nem garante que o pet ainda esteja no servidor. A lista pública de servidores é real, porém o botão Entrar depende do aplicativo Roblox, da disponibilidade da sala e do suporte do dispositivo.

## Publicar na Netlify corretamente

1. Baixe e **extraia** `GiganteFinder-SITE-NOVO.zip`.
2. Crie um repositório GitHub, por exemplo `GiganteFinder`.
3. **Abra a pasta extraída e envie O CONTEÚDO dela** para a página inicial do repositório (não envie o ZIP e não coloque tudo dentro de outra pasta).
4. Na página inicial do GitHub devem aparecer **diretamente**:

```text
public/
netlify/
scripts/
netlify.toml
package.json
README.md
```

5. Netlify → **Add new project** → **Import from Git** → GitHub → selecione o repositório.
6. Confirme os campos: **Base directory** vazio, **Publish directory** `public`, **Build command** `npm run build`, **Functions directory** `netlify/functions`. O `netlify.toml` já informa isso.
7. Clique em Deploy; aguarde **Published**. Não precisa de chave Roblox nem banco externo para os relatos, porque o Netlify Blobs é integrado às Functions.
8. Teste o backend abrindo: `https://SEU-SITE.netlify.app/.netlify/functions/api?action=health`. Deve aparecer JSON com `"ok":true`.
9. Abra o site e clique em "Procurar servidores". A comunicação real com Roblox ainda precisa ser testada na produção.

## Prévia no computador

Abra `public/index.html` com o Microsoft Edge para olhar o **visual**. Os servidores e relatos precisam das Functions, então **não funcionarão em arquivo local**.

## Cuidados

- Nunca colete senhas de contas Roblox.
- Não divulgue relatos como confirmação automática: avistamentos podem ser falsos, atrasados ou mudar rapidamente.
- Há limite básico de um relato por IP a cada 90 segundos para reduzir spam, mas isso não substitui moderação.
- Sites com alto tráfego podem precisar de moderação e banco de dados dedicado.
- O projeto é independente e não é afiliado à Roblox Corporation nem aos desenvolvedores do jogo.

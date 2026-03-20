# Carrossel Brand Kit

Projeto pronto para subir no GitHub.

## O que vai para o GitHub
- frontend React/Vite
- codigo do backend Express
- arquivos .env.example
- workflow de deploy do GitHub Pages

## O que NAO vai para o GitHub
- .env
- server/.env
- node_modules
- logs
- dist

## GitHub Pages
O frontend desta pasta pode ser publicado no GitHub Pages.

### Como publicar
1. Crie um repositorio no GitHub.
2. Envie o conteudo desta pasta para a branch `main`.
3. No GitHub, abra `Settings > Pages`.
4. Em `Build and deployment`, escolha `GitHub Actions`.
5. O workflow `.github/workflows/deploy-pages.yml` vai publicar automaticamente.

## Backend
O backend nao roda no GitHub Pages. Para a parte com IA funcionar, publique a pasta `server` em Render, Railway, Vercel ou outro servico backend.

## Rodando localmente
### Frontend
1. `npm install`
2. Copie `.env.example` para `.env`
3. `npm run dev`

### Backend
1. `cd server`
2. `npm install`
3. Copie `.env.example` para `.env`
4. Preencha `ANTHROPIC_API_KEY`
5. `node --env-file=.env index.js`

## Build
`npm run build`

## Observacao
O app funciona em modo manual mesmo sem credito na Anthropic.

# Backend AHMS (Innotech)

API Node.js + Express do Astronaut Health Monitoring System (AHMS), projeto desenvolvido pela startup Innotech.

## Executar

```powershell
cd backend
npm install
npm run dev
```

Por omissão, a API fica disponível em `http://localhost:4000`.

## Organização

- `src/app.js`: configuração Express e montagem das rotas.
- `src/server.js`: inicialização da base de dados e arranque HTTP.
- `src/config/`: configurações de segurança.
- `src/middleware/`: segurança, tratamento de erros e respostas 404.
- `src/lib/`: utilitários partilhados de validação, SQLite e handlers assíncronos.
- `src/features/health/`: estado da API.
- `src/features/astronauts/`: listagem e resumo dos astronautas.
- `src/features/measurements/`: registo e análise de medições.
- `src/features/checkins/`: check-in diário.
- `src/features/alerts/`: consulta e análise de alertas.
- `src/features/symptoms/`: consulta e registo de sintomas.
- `src/features/exercise/`: consulta e registo de actividade física.
- `src/features/auth/`: início/fim de sessão, credenciais e autorização.
- `src/features/baseline/`: cálculo persistente da referência individual.
- `src/scripts/create-user.js`: criação local de contas sem endpoint público de registo.
- `src/db.js`: esquema e inicialização SQLite.
- `data/innotech.db`: base de dados local criada automaticamente.

## Rotas

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/astronauts`
- `GET /api/astronauts/:id/summary`
- `GET /api/astronauts/:id/alerts`
- `GET /api/astronauts/:id/symptoms`
- `POST /api/astronauts/:id/symptoms`
- `GET /api/astronauts/:id/exercises`
- `POST /api/astronauts/:id/exercises`
- `POST /api/astronauts/:id/checkin`
- `POST /api/astronauts/:id/measurements`

## Contas e acesso

Crie cada conta localmente no backend; não existe registo público. Execute `npm run create-user` e siga as perguntas interactivas. As palavras-passe devem ter pelo menos 12 caracteres e são guardadas com scrypt. Uma conta de astronauta fica associada a um único ID; uma conta Mission Control pode consultar a tripulação mas não pode alterar registos. As sessões são aleatórias, limitadas a 8 horas e transportadas apenas em cookie HttpOnly/SameSite.

Todos os endpoints de astronautas exigem sessão. `GET /api/health` e `POST /api/auth/login` são públicos. Defina `CORS_ORIGINS` com as origens exactas do frontend, separadas por vírgulas. Em produção, use HTTPS (`NODE_ENV=production`) e configure origens distintas e controladas.

O protótipo usa dados simulados e não fornece diagnóstico médico. A implementação ainda requer revisão de segurança e validação clínica antes de qualquer utilização com dados reais.

## Baseline e sinalizações

Na primeira consulta do resumo, o backend estabelece uma mediana fixa para cada indicador que tenha pelo menos cinco observações numéricas. Usa os cinco primeiros registos válidos por indicador; a referência e a data do último registo de origem ficam guardadas em `individual_baselines` e não são recalculadas automaticamente. Indicadores sem amostras suficientes permanecem em recolha.

As regras demonstrativas só procuram uma variação depois da baseline: os três registos mais recentes disponíveis do indicador têm de estar todos acima ou todos abaixo da referência. Uma sinalização em vários indicadores recebe nível operacional `Prioridade`; não existem limiares clínicos nem estado “Normal” inferido. A interface informa que uma ausência de sinalização não significa ausência de risco. Alterações à baseline exigem desenho, consentimento e validação próprios; não apagar ou alterar os registos de origem.

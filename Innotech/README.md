# Astronaut Health Monitoring System (AHMS)

Frontend React + Vite do Astronaut Health Monitoring System (AHMS), projeto de monitorização de saúde de astronautas desenvolvido pela startup participante Innotech para o NASA Space Apps Challenge 2026.

## Visão geral

O AHMS é uma ferramenta de acompanhamento de saúde concebida para missões espaciais de longa duração. O projeto é desenvolvido pela startup Innotech. O sistema recolhe indicadores físicos e comportamentais, estabelece um padrão individual (baseline) para cada astronauta e acompanha alterações ao longo do tempo. Quando identifica desvios relevantes, apresenta alertas e orientações de acompanhamento.

**Atenção:** Esta aplicação é uma ferramenta de acompanhamento. Não substitui profissionais de saúde, não fornece diagnóstico médico e não deve ser utilizada como único mecanismo de decisão clínica.

## Utilizadores

- **Astronauta:** acompanha os seus próprios indicadores, realiza check-ins diários, regista sintomas e medições, consulta histórico e tendências.
- **Mission Control:** consulta a lista da tripulação, o estado atual de cada astronauta, alertas ativos e tendências de saúde.

## Stack tecnológica

- **Framework:** React 19 com Vite
- **Estilos:** CSS Modules (ficheiros `.module.css` por componente/página) + variáveis CSS globais em `src/index.css`
- **Gráficos:** SVG nativo (sem bibliotecas externas de gráficos)
- **Lint:** oxlint
- **Build:** Vite

## Estrutura do projeto

```
src/
├── index.css                 # Variáveis CSS globais, reset, animações base (keyframes)
├── App.jsx                   # Componente raiz com navegação entre páginas
├── App.module.css            # Estilos do layout principal (cabeçalho, área de conteúdo)
├── lib/
│   └── api.js                # Camada centralizada de chamadas à API (fetch com timeout, tratamento de erros)
├── components/
│   ├── Navbar.jsx / Navbar.module.css              # Navegação do AHMS com identificação Innotech
│   ├── ConnectionStatus.jsx / ConnectionStatus.module.css  # Estado de ligação à API (ligado/offline/verificando)
│   ├── AlertBadge.jsx / AlertBadge.module.css      # Insígnia de estado (Normal / Atenção / Prioridade)
│   ├── MetricCard.jsx / MetricCard.module.css      # Cartão de indicador com valor, unidade e tendência
│   ├── TrendChart.jsx / TrendChart.module.css      # Gráfico de tendência em SVG com animação de traçado
│   ├── ErrorMessage.jsx / ErrorMessage.module.css  # Mensagem de erro com botão de tentar novamente
│   ├── LoadingSpinner.jsx / LoadingSpinner.module.css  # Spinner de carregamento
│   ├── AstronautSelector.jsx / AstronautSelector.module.css  # Selector de astronauta da lista da API
│   ├── Form.module.css                 # Estilos partilhados de formulários (campos, validação, mensagens)
│   ├── CheckinForm.jsx                 # Formulário de check-in diário
│   └── MeasurementsForm.jsx            # Formulário de registo de medições fisiológicas
└── pages/
    ├── LoginPage.jsx / LoginPage.module.css          # Ecrã de entrada para demonstração
    ├── DashboardPage.jsx / DashboardPage.module.css   # Painel do astronauta
    └── MissionControlPage.jsx / MissionControlPage.module.css  # Painel do Mission Control
```

## Funcionalidades implementadas

### 1. Navegação
- Ecrã de entrada de demonstração permite escolher a área de astronauta ou a área colaborativa Mission Control.
- Cabeçalho identifica o projeto como **Astronaut Health Monitoring System (AHMS)** e a startup participante como **Innotech**.
- A área selecionada tem saída explícita para regressar ao ecrã de entrada.
- Indicador de estado de ligação à API (ligado, offline, a verificar) em tempo real.
- Todos os botões de navegação executam ações reais (não são decorativos).

### 2. Painel do astronauta
- Seleção de astronauta a partir da lista servida pela API (`GET /api/astronauts`).
- Indicadores mais recentes: frequência cardíaca, saturação de oxigénio, frequência respiratória, sono, stress, fadiga e humor.
- Estado geral e alerta retornado pelo backend (`GET /api/astronauts/:id/summary`).
- Gráficos de tendência histórica para sono, frequência cardíaca, stress e fadiga (`GET /api/astronauts/:id/summary`).
- Alertas recentes e sintomas registados (`GET /api/astronauts/:id/alerts`, `GET /api/astronauts/:id/symptoms`).
- Estados de carregamento, erro e ausência de dados.

### 3. Check-in diário
- Formulário com horas de sono, stress (0–10), fadiga (0–10), humor e observação opcional.
- Validação no cliente com mensagens de erro junto aos campos.
- Envio via `POST /api/astronauts/:id/checkin`.
- Feedback de sucesso ou erro sem apagar os dados introduzidos.
- Nota visível de que não constitui diagnóstico médico.

### 4. Registo de medições
- Formulário com frequência cardíaca (30–220), saturação de oxigénio (70–100), frequência respiratória (6–60), sono (0–24), stress (0–10), fadiga (0–10) e humor.
- Respeita os intervalos validados pelo backend.
- Envio via `POST /api/astronauts/:id/measurements`.
- Erros da API apresentados de forma clara; formulário mantido acessível em caso de falha.

### 5. Mission Control
- Área de trabalho colaborativa para a equipa de Mission Control em Terra — não é um perfil de astronauta.
- Lista apenas astronautas (`role = astronaut`) com estado calculado a partir dos resumos atuais.
- Seleção de um astronauta para ver resumo, tendência e alertas dessa pessoa.
- Quando não há dados, mostra “Não avaliado”; quando a API falha, mostra “Indisponível” e permite repetir.
- Registo temporal de alertas com prioridade, data e descrição.

## Integração com a API

O backend (Node.js/Express + SQLite) corre por omissão em `http://localhost:4000`.

### Configuração
A URL da API é configurada através da variável de ambiente `VITE_API_BASE_URL`. Se não estiver definida, usa `http://localhost:4000` como valor de desenvolvimento.

```bash
# Exemplo: variável de ambiente para produção
VITE_API_BASE_URL=https://api.inno.tech npm run dev
```

### Camada de API (`src/lib/api.js`)
Todas as chamadas à API são centralizadas em `src/lib/api.js`, que:
- Usa `fetch` com timeout de 10 segundos.
- Trata erros HTTP, JSON inválido, timeout e rede indisponível.
- Lança `ApiError` com status e mensagem para tratamento nos componentes.
- Não armazena segredos nem chaves privadas no frontend.

### Rotas utilizadas
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/health` | Verificação de estado da API |
| GET | `/api/astronauts` | Lista de astronautas |
| GET | `/api/astronauts/:id/summary` | Resumo de saúde, alerta e tendência |
| GET | `/api/astronauts/:id/alerts` | Alertas de um astronauta |
| GET | `/api/astronauts/:id/symptoms` | Sintomas de um astronauta |
| POST | `/api/astronauts/:id/checkin` | Registo de check-in diário |
| POST | `/api/astronauts/:id/measurements` | Registo de medições fisiológicas |

### Payloads
**Check-in:**
```json
{
  "sleepHours": 7,
  "stressLevel": 3,
  "fatigueLevel": 2,
  "mood": "Normal",
  "note": "Observação opcional"
}
```

**Medições:**
```json
{
  "heartRate": 65,
  "oxygenSaturation": 98,
  "respiratoryRate": 15,
  "sleepHours": 7,
  "stressLevel": 3,
  "fatigueLevel": 2,
  "mood": "Normal"
}
```

## Direção visual

- Paleta escura azul-marinho com acentos teal/ciano (`--accent: #2dd4bf`).
- Suporte a esquema de cores claro (`prefers-color-scheme: light`).
- Estados Normal, Atenção e Prioridade visualmente distintos (cores, formas de ícone e texto), nunca identificados apenas pela cor.
- Ícones simples geométricos (círculo, triângulo, quadrado); sem emojis funcionais.
- Responsiva para desktop, tablet e telemóvel.
- Acessível por teclado: foco visível, labels em todos os campos, contraste adequado, navegação por Tab.
- Texto em português europeu.
- Ecrã inicial inspirado em interfaces de operação de missão, com transições suaves, estados de foco e redução de movimento respeitada.

## Animações

- `fadeIn`: entrada suave de elementos.
- `slideIn`: deslizar para baixo ao aparecer.
- `pulse`: pulso no ponto de ligação offline.
- `spin`: rotação no spinner de carregamento.
- `shimmer`: efeito de brilho em placeholders de dados indisponíveis.
- `float`: flutuação suave da marca Innotech.
- `pulseGlow`: brilho pulsante no alerta de estado.
- `shake`: tremer em campos com erro de validação.
- `draw`: traçado animado das linhas dos gráficos SVG.

## Comandos de execução

### Backend (obrigatório para o frontend funcionar)
```powershell
cd frontend\Innotech\Innotech\backend
npm install
npm run dev        # Porta 4000
```

### Frontend
```powershell
cd frontend\Innotech\Innotech
npm install
npm run dev        # Porta 5173
```

### Verificações de qualidade
```powershell
npm run lint       # oxlint (deve passar sem erros)
npm run build      # Vite build para produção
npm run preview    # Pré-visualização do build de produção
```

## Qualidade

- `npm run lint` executa sem erros (apenas avisos de hooks do React que não afetam a funcionalidade).
- `npm run build` gera o bundle de produção com sucesso.
- CSS Modules evitam conflitos de nomes de classe e dão escopo aos estilos por componente.
- Sem bibliotecas externas de gráficos ou roteamento; dependências mantidas ao mínimo.
- Sem credenciais nem segredos no código frontend.

## Limitações

- O protótipo utiliza dados simulados servidos pelo backend SQLite.
- Não é um sistema de diagnóstico médico.
- O ecrã de entrada é apenas uma seleção de perfil para demonstração local, não autentica nem autoriza utilizadores. A autenticação real e o controlo de permissões têm de ser implementados no backend.
- O funcionamento offline (offline-first) está descrito na especificação (`explain.txt`) mas ainda não implementado no frontend.

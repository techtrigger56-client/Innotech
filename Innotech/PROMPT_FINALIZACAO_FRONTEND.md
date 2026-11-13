# Prompt para finalizar o frontend AHMS

Continua o desenvolvimento do frontend do **Astronaut Health Monitoring System (AHMS)**, projeto da startup participante **Innotech**, no React + Vite existente. Trabalha apenas dentro deste projeto e preserva as funcionalidades já implementadas.

## Contexto

O painel do astronauta e o Mission Control já consomem a API Express em `backend/`. A recuperação após erros e o refrescamento após registos foram corrigidos. Quando não há avaliação, a interface já não deve apresentar o estado como “Normal”.

## Trabalho restante

1. **Corrigir os gráficos do Mission Control**
   - `TrendChart` faz cálculos geométricos com uma largura numérica, mas `MissionControlPage` passa atualmente `width="100%"`.
   - Tornar o SVG responsivo sem fazer aritmética com strings; usar dimensões numéricas e `viewBox` com `preserveAspectRatio`, ou calcular dimensões com `ResizeObserver`.
   - Confirmar que os gráficos continuam a funcionar no painel do astronauta e em ecrãs estreitos.
   - Fornecer nomes acessíveis e unidades compreensíveis para cada gráfico.

2. **Apresentar o estado atual da tripulação**
   - A lista do Mission Control não deve apresentar `astronaut.status` armazenado como se fosse uma avaliação atual: esse campo pode estar desatualizado.
   - Obter o resumo e o alerta atuais através de `GET /api/astronauts/:id/summary` e apresentar um estado “Não avaliado” quando não houver dados/alerta.
   - Incluir carregamento, erro e nova tentativa sem converter falhas de rede em estado Normal.
   - Evitar requests sem limite e garantir que resultados de pedidos antigos não substituem a seleção atual.

3. **Corrigir idioma e metadados**
   - Definir o idioma do documento como português europeu (`pt-PT`).
   - Manter o nome do produto como “Astronaut Health Monitoring System (AHMS)” e identificar Innotech apenas como startup participante.
   - Garantir que o título da página e os textos acessíveis seguem a mesma identidade.

4. **Resolver os avisos do lint**
   - Rever `react(set-state-in-effect)` e `react-hooks(exhaustive-deps)` nos dois painéis.
   - Não silenciar regras com comentários ou configurações; refatorar os efeitos e carregamentos para remover closures obsoletas e dependências omitidas.

5. **Verificação final**
   - Executar `npm run lint` e `npm run build`.
   - Testar no browser desktop e móvel: estados com dados, sem dados, offline, erro, retry e troca rápida de astronauta.
   - Não iniciar ou deixar servidores ativos após terminar a verificação. Se for necessário iniciá-los para testes, encerrá-los completamente no fim.

## Restrições

- Não alterar as regras de análise de saúde nem apresentar alertas como diagnóstico.
- Não incluir dados médicos ou credenciais reais no frontend.
- Não usar `INNOTECH_API_KEY` no browser.
- Preservar navegação, formulários, histórico e mensagens de não diagnóstico já existentes.
- Fazer alterações cirúrgicas e atualizar a documentação caso o comportamento documentado mude.


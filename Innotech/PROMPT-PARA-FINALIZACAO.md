# Prompt para finalizar o AHMS

Continua o projecto **Astronaut Health Monitoring System (AHMS)** em `frontend/Innotech/Innotech`, desenvolvido pela startup participante Innotech. Usa `explain.txt` como especificação e `CHECKLIST-EXPLAIN.md` como estado actual. O projecto já tem frontend React/Vite, backend Node/Express, SQLite, dashboard, Mission Control demonstrativo, registo de medições/check-ins/sintomas/exercício e histórico.

## Objectivo

Finalizar o MVP sem apresentar funcionalidades demonstrativas como segurança real, diagnóstico médico ou operação offline já resolvida. Antes de alterar, inspecciona os fluxos existentes e preserva os padrões visuais, dados e compatibilidade da API.

## Estado desta continuação

Autenticação básica e autorização foram implementadas: contas locais criadas por `backend/npm run create-user`, passwords com scrypt, sessão opaca em cookie HttpOnly/SameSite, limitação de tentativas, acesso de astronauta restrito à própria conta e Mission Control em modo de consulta. A etapa 1 está concluída para o protótipo; autorização por missão/equipa, auditoria e revisão de segurança continuam pendentes.

A baseline demonstrativa também foi implementada e testada. Guarda a mediana fixa dos primeiros cinco registos válidos por indicador; não se altera automaticamente. Uma sinalização só ocorre quando os três registos mais recentes pós-baseline ficam do mesmo lado da referência. Estados insuficientes não aparecem como “Normal”; sinalizações e recomendações são explicitamente não clínicas. A etapa 2 está concluída como protótipo, não como algoritmo validado. O modo offline básico da etapa 3 está implementado; falta integração ponta a ponta com API/SQLite e validação em browsers/dispositivos reais.

Na continuação mais recente foram acrescentados ao check-in isolamento, qualidade da concentração, motivação e qualidade do sono (escala 0–10, opcional e validada); os valores são persistidos por migração aditiva, devolvidos no resumo e apresentados em gráficos no dashboard e em Mission Control. O registo de sintomas tem categorias predefinidas (dor de cabeça, tontura, náusea, dor muscular, fadiga, dificuldade respiratória e outro) e mantém observações livres e compatibilidade com registos antigos. Mission Control mostra os indicadores comportamentais recentes e uma cronologia paginada de medições/check-ins, sintomas, alertas e exercício. Testes cobrem migração de bases antigas, campos comportamentais opcionais/validados, categorias e paginação/autorização do histórico; estas escalas não estão validadas clinicamente.

O modo offline tem uma implementação integrada: IndexedDB cifra cache e fila com AES-GCM; a chave é derivada de frase-passe independente com PBKDF2/SHA-256 (600.000 iterações) e não é persistida. O service worker serve apenas shell/recursos same-origin, sem guardar respostas `/api/`. A interface permite configurar/desbloquear cofre, mostra registos por sincronizar e distingue avaliação offline de avaliação do servidor. Escritas incluem `Idempotency-Key`; o backend reproduz respostas concluídas e rejeita a mesma chave com payload diferente. Operações bloqueadas mostram a causa, oferecem repetição segura para 409 com a mesma chave e remoção local explícita com confirmação. Testes backend cobrem replay, payload divergente e chave ausente; validação no browser com respostas simuladas cobriu sucesso parcial, 409, 401/expiração, desbloqueio posterior, isolamento de conta e revisão de operação bloqueada. Isto **não** valida uma solução de produção nem substitui testes integrados em servidor/browser reais ou revisão de segurança.

Na etapa 4 foram acrescentados resumo de exercício para 7/30 dias, filtros temporais/tipo no dashboard e uma rota de histórico unificado/paginado por astronauta. Mission Control mostra nessa timeline medições/check-ins, sintomas, exercícios e alertas, por data e tipo; o endpoint aceita 1–100 registos por página e foi coberto por testes de autorização, paginação, ordenação e limites. Os gráficos usam até 90 medições. Não existe modelo de eventos gerais da missão nem agregação diária.

Na continuação seguinte, o check-in foi ampliado com escalas opcionais de isolamento, concentração, motivação e qualidade do sono; sintomas ganharam categorias e compatibilidade de migração. Foi corrigido o seed para não duplicar os dados de demonstração a cada arranque. A análise offline partilha agora a regra demonstrativa do backend e pode usar histórico/baseline cifrados e escritas locais pendentes, deixando claro que não é confirmada em Terra. Lint, build e os testes backend passaram; a sincronização com API/SQLite real continua sem teste integrado.

## Próxima fase realmente pendente

1. Criar testes de integração ponta a ponta da fila offline contra API/SQLite para reconexão, expiração da sessão e falha parcial; definir procedimento operacional para conflitos por payload divergente e perda/troca de dispositivo.
2. Completar autorização configurável por missão/equipa, auditoria de acessos e revisão de segurança antes de dados reais.
3. Rever baseline, regras e escalas de bem-estar com profissionais; manter os resultados não clínicos até validação e aprovação.
4. Acrescentar médias agregadas e eventos gerais de missão numa categoria própria; considerar retenção e exportação com requisitos explícitos.
5. Se necessário para a demonstração, gerar dados simulados de vários meses e testar a propagação coerente das avaliações, sem apresentar dados fictícios como reais.

## Ordem de trabalho

1. **Autenticação e permissões**
   - Substituir a escolha de perfil demonstrativa por autenticação real com sessões/token seguro e gestão de credenciais adequada.
   - Definir autorização por função e por astronauta: astronauta consulta/altera apenas os seus dados; equipa Mission Control consulta apenas os dados autorizados.
   - Proteger todas as rotas de dados, incluindo listagens, medições, check-ins, sintomas, exercício, alertas e resumos.
   - Remover chaves partilhadas como substituto da identidade do utilizador. Não guardar segredos no frontend nem usar a chave opcional da API como login.
   - Adicionar testes para utilizador não autenticado, acesso cruzado entre astronautas, função sem permissão e acesso autorizado.

2. **Baseline individual e análise**
   - Definir como e quando uma baseline pode ser calculada, quantas observações válidas exige, que indicadores suporta e como se actualiza.
   - Não produzir baseline nem alerta individual com dados insuficientes; comunicar explicitamente esse estado.
   - Comparar medições e tendências com o histórico individual, distinguindo valores observados de limiares clínicos.
   - Rever `alerts.service.js`: não declarar estado “Normal” por inferência sem suporte, não chamar genericamente “fora do padrão habitual” a valores comparados com médias da própria janela e não usar critérios clínicos improvisados.
   - Gerar recomendações de acompanhamento prudentes, ligadas aos sinais e ao protocolo, sem diagnóstico nem aconselhamento médico específico. Identificar que as regras necessitam validação clínica.
   - Testar dados vazios, insuficientes, estáveis, tendência sustentada e indicadores em direcções diferentes.

3. **Modo offline**
   - Completar a abordagem existente com reconciliação de conflitos e procedimentos de recuperação/revisão para operações bloqueadas.
   - Manter a protecção actual: cache e fila em IndexedDB cifradas, frase-passe offline separada, chave só em memória e sem persistir credenciais/token. O service worker não deve guardar respostas API.
   - Preservar estados explícitos: dados guardados localmente não são sincronizados; a análise offline partilha a regra demonstrativa do backend usando apenas baseline/histórico cifrados e registos locais. Identificar a saída como local/não confirmada em Terra e manter “Não avaliado” sem dados suficientes; escritas são repetidas com a mesma chave idempotente.
   - Integrar a fila com servidor de teste e acrescentar testes ponta a ponta para reconexão, sessão expirada, falha parcial e operação bloqueada. A validação actual cobre estes caminhos com respostas de rede simuladas, não testes integrados de sincronização com API/SQLite real nem mudança de dispositivo.

4. **Histórico e fecho do MVP**
   - A cronologia paginada de Mission Control está implementada/testada. Avaliar retenção e exportação, acrescentar médias agregadas e criar modelo próprio para eventos gerais de missão sem misturar alertas, sintomas, medições e actividades.
   - Validar os dados simulados multidiários/mensais e a propagação coerente das avaliações, mantendo explícito que não são dados reais.
   - Actualizar a checklist com evidência real por secção; manter itens do capítulo 30 classificados como evolução futura.
   - Executar lint, build e testes backend/frontend relevantes. Se iniciar qualquer servidor para validação, terminá-lo no fim e confirmar que ficou encerrado.

## Restrições de produto

- Manter Innotech como startup, não como nome do produto.
- Mission Control representa uma equipa em Terra, não uma pessoa/astronauta.
- Preservar a indicação de protótipo/dados simulados e a mensagem de que AHMS não diagnostica nem substitui profissionais de saúde.
- Não marcar uma funcionalidade como concluída sem implementação e teste verificáveis.
- Não introduzir dependências sem necessidade e não alterar/remover dados existentes sem migração segura.
- Fazer alterações cirúrgicas, actualizar a checklist/documentação e terminar com um resumo de funcionalidades, limitações e comandos de validação.

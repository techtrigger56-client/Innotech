# Manual de utilização rápida

## 1. Iniciar o backend

Acede à pasta do backend:

```bash
cd backend
npm install
npm run dev
```

O backend fica disponível em:

```text
http://localhost:4000
```

## 2. Iniciar o frontend

Em outro terminal, abre a pasta do frontend:

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

O frontend fica disponível em:

```text
http://localhost:5173
```

## 3. Login de demonstração

Usa as credenciais criadas na base de dados configurada para o backend. Em desenvolvimento local, podes criar uma conta com:

```bash
cd backend
npm run create-user
```

Depois inicia sessão na interface do frontend.

Quando o script pede "ID do astronauta associado", usa um astronauta existente. Os IDs de demonstração são:

```text
astro-01
astro-02
```

Para uma conta de Mission Control, o campo do ID não é necessário.

### Contas na Render Free com Turso

A Render Free não tem Shell nem armazenamento persistente. Com Turso configurado, cria as contas no teu computador, apontando temporariamente para a base Turso da Render:

```powershell
cd backend
$env:TURSO_DATABASE_URL = "libsql://..."
$env:TURSO_AUTH_TOKEN = "token-da-base"
npm run create-user
Remove-Item Env:TURSO_DATABASE_URL
Remove-Item Env:TURSO_AUTH_TOKEN
```

O token é secreto: não o partilhes nem o coloques no frontend ou no GitHub.

## 4. Funcionalidades principais

- acompanhar saúde do astronauta;
- registar check-ins diários;
- inserir sintomas e medições;
- consultar alertas e histórico;
- ver painel de Mission Control.

## 5. Parar os servidores

No terminal em execução, usa:

```bash
Ctrl + C
```

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

Usa as credenciais criadas localmente no backend ou executa a criação de utilizador, se ainda não existir:

```bash
cd backend
npm run create-user
```

Depois inicia sessão na interface do frontend.

Importante: quando o script pede "ID do astronauta associado", esse valor tem de corresponder a um astronauta já existente na base de dados. Os IDs padrões do protótipo são:

```text
astro-01
astro-02
```

Se quiser criar uma conta de astronauta, escolhe um destes IDs válidos. Para uma conta de Mission Control, este campo não é necessário.

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

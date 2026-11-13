import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { initializeDatabase, getDb } from '../db.js';
import { execute, queryAll } from '../lib/sqlite.js';
import { hashPassword } from '../features/auth/auth.service.js';

function readHiddenPassword(prompt) {
  if (!stdin.isTTY) {
    throw new Error('A criação de utilizadores requer um terminal interactivo.');
  }

  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();

  return new Promise((resolve, reject) => {
    let value = '';
    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
    };
    const onData = (chunk) => {
      for (const character of chunk.toString()) {
        if (character === '\u0003') {
          cleanup();
          stdout.write('\n');
          reject(new Error('Operação cancelada.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          cleanup();
          stdout.write('\n');
          resolve(value);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          if (value.length) {
            value = value.slice(0, -1);
            stdout.write('\b \b');
          }
          continue;
        }
        if (character >= ' ' && character !== '\u007f') {
          value += character;
          stdout.write('*');
        }
      }
    };

    stdin.on('data', onData);
  });
}

async function main() {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error('A criação de utilizadores requer um terminal interactivo.');
  }

  const prompt = readline.createInterface({ input: stdin, output: stdout });
  let email;
  let role;
  let astronautId = null;
  try {
    email = (await prompt.question('E-mail da conta: ')).trim().toLowerCase();
    role = (await prompt.question('Função (astronaut ou mission-control): ')).trim();
    if (role === 'astronaut') {
      astronautId = (await prompt.question('ID do astronauta associado: ')).trim();
    }
  } finally {
    prompt.close();
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error('E-mail inválido.');
  }
  if (!['astronaut', 'mission-control'].includes(role)) {
    throw new Error('Função inválida.');
  }

  const password = await readHiddenPassword('Palavra-passe (mínimo 12 caracteres): ');
  if (password.length < 12 || password.length > 256) {
    throw new Error('A palavra-passe deve ter entre 12 e 256 caracteres.');
  }

  await initializeDatabase();
  if (role === 'astronaut') {
    const astronaut = await queryAll(
      "SELECT id FROM astronauts WHERE id = ? AND role = 'astronaut'",
      [astronautId]
    );
    if (!astronaut.length) {
      throw new Error('Não existe um astronauta com esse ID.');
    }
  }

  await execute(
    'INSERT INTO users (email, password_hash, role, astronaut_id) VALUES (?, ?, ?, ?)',
    [email, await hashPassword(password), role, role === 'astronaut' ? astronautId : null]
  );
  console.log(`Conta ${role} criada para ${email}.`);
}

main()
  .catch((error) => {
    console.error(`Não foi possível criar a conta: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => {
    getDb().close((error) => {
      if (error) {
        console.error('Não foi possível fechar a base de dados:', error.message);
        process.exitCode = 1;
      }
    });
  });

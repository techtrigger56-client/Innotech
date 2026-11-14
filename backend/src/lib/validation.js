export function validateAstronautId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,60}$/.test(value)) {
    const error = new Error('Identificador do astronauta inválido.');
    error.status = 400;
    throw error;
  }

  return value;
}

export function validateNumber(value, fieldName, min, max) {
  if (value === undefined || value === null || value === '') {
    const error = new Error(`${fieldName} é obrigatório.`);
    error.status = 400;
    throw error;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < min || numericValue > max) {
    const error = new Error(`${fieldName} deve estar entre ${min} e ${max}.`);
    error.status = 400;
    throw error;
  }

  return numericValue;
}

export function validateOptionalNumber(value, fieldName, min, max) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return validateNumber(value, fieldName, min, max);
}

export function sanitizeText(value, maxLength = 250) {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value !== 'string') {
    const error = new Error('O texto enviado deve ser uma string.');
    error.status = 400;
    throw error;
  }

  return value.replace(/[<>]/g, '').trim().slice(0, maxLength);
}

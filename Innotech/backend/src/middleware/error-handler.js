export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Endpoint não encontrado.' });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'O corpo JSON da requisição é inválido.' });
    return;
  }

  if (error.message === 'Origem não autorizada pelo CORS.') {
    res.status(403).json({ error: error.message });
    return;
  }

  if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error('Innotech API error:', error);
  res.status(500).json({ error: 'Ocorreu um erro interno.' });
}

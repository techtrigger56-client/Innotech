import { useEffect, useRef, useState } from 'react';
import styles from './MissionControlPage.module.css';
import { api } from '../lib/api.js';
import AlertBadge from '../components/AlertBadge.jsx';
import MetricCard from '../components/MetricCard.jsx';
import TrendChart from '../components/TrendChart.jsx';
import BaselineSummary from '../components/BaselineSummary.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

async function loadCrewSnapshot() {
  const data = await api.listAstronauts();
  const crew = (data || []).filter((person) => person.role === 'astronaut');
  const results = await Promise.all(
    crew.map(async (astronaut) => {
      try {
        return { id: astronaut.id, summary: await api.getSummary(astronaut.id), error: null };
      } catch (requestError) {
        return {
          id: astronaut.id,
          summary: null,
          error: requestError.message || 'Não foi possível carregar o resumo.',
        };
      }

    })
  );

  return {
    crew,
    summaries: Object.fromEntries(results.filter((item) => item.summary).map((item) => [item.id, item.summary])),
    errorsById: Object.fromEntries(results.filter((item) => item.error).map((item) => [item.id, item.error])),
  };
}

export default function MissionControlPage() {
  const [astronauts, setAstronauts] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [historyById, setHistoryById] = useState({});
  const [errorsById, setErrorsById] = useState({});
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState({ list: true, summaries: false, selected: false });
  const [error, setError] = useState(null);
  const [retryError, setRetryError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const selectedRequestRef = useRef(0);
  const historyRequestRef = useRef(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyRequestKey, setHistoryRequestKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    loadCrewSnapshot()
      .then((snapshot) => {
        if (cancelled) return;
        setAstronauts(snapshot.crew);
        setSummaries(snapshot.summaries);
        setErrorsById(snapshot.errorsById);
        setError(null);
        setLoading({ list: false, summaries: false, selected: false });
      })
      .catch((requestError) => {
        if (cancelled) return;
        setError(requestError.message || 'Não foi possível carregar a tripulação.');
        setLoading({ list: false, summaries: false, selected: false });
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!selectedId) return undefined;
    const requestId = ++historyRequestRef.current;
    let cancelled = false;

    api.getMissionHistory(selectedId, historyPage)
      .then((result) => {
        if (cancelled || requestId !== historyRequestRef.current) return;
        setHistoryById((previous) => ({ ...previous, [selectedId]: result }));
      })
      .catch((requestError) => {
        if (cancelled || requestId !== historyRequestRef.current) return;
        setHistoryError(requestError.message || 'Não foi possível carregar o histórico da missão.');
      })
      .finally(() => {
        if (!cancelled && requestId === historyRequestRef.current) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId, historyPage, reloadKey, historyRequestKey]);

  const handleRetry = () => {
    setRetryError(null);
    setHistoryLoading(Boolean(selectedId));
    setHistoryError('');
    setError(null);
    setLoading({ list: true, summaries: false, selected: false });
    setReloadKey((key) => key + 1);
  };

  const selectAstronaut = async (id) => {
    const requestId = ++selectedRequestRef.current;
    setSelectedId(id);
    if (id !== selectedId || historyPage !== 1) setHistoryLoading(true);
    setHistoryPage(1);
    setHistoryError('');
    setRetryError(null);
    setLoading((previous) => ({ ...previous, selected: true }));

    const [summaryResult] = await Promise.allSettled([api.getSummary(id)]);

    if (requestId !== selectedRequestRef.current) return;

    if (summaryResult.status === 'fulfilled') {
      setSummaries((previous) => ({ ...previous, [id]: summaryResult.value }));
    }
    const requestError = summaryResult.status === 'rejected' ? summaryResult.reason : null;
    setErrorsById((previous) => {
      const next = { ...previous };
      if (requestError) next[id] = requestError.message;
      else delete next[id];
      return next;
    });
    setRetryError(requestError?.message || null);
    setLoading((previous) => ({ ...previous, selected: false }));
  };

  const latestFor = (id) => summaries[id]?.latest ?? null;
  const alertFor = (id) => summaries[id]?.alert ?? null;
  const currentAlertCount = astronauts.filter((person) => alertFor(person.id)?.level === 'Prioridade').length;
  const attentionCount = astronauts.filter((person) => alertFor(person.id)?.level === 'Atenção').length;

  if (loading.list) {
    return <LoadingSpinner message="A carregar a equipa e os dados da tripulação…" />;
  }

  if (error) {
    return (
      <div className={styles.page}>
        <ErrorMessage message={error} onRetry={handleRetry} />
      </div>
    );
  }

  return (
    <div className={`${styles.page} ${styles.missionControlPage}`}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>CENTRO DE OPERAÇÕES · EQUIPA EM TERRA</p>
          <h1>Mission Control</h1>
          <p className={styles.intro}>
            Área colaborativa para acompanhar a tripulação, rever alterações e consultar
            os registos da missão.
          </p>
        </div>
        <button type="button" className={styles.refreshButton} onClick={handleRetry}>
          Atualizar dados
        </button>
      </header>

      <section className={styles.overview} aria-label="Resumo da tripulação">
        <article className={styles.overviewCard}>
          <span className={styles.overviewLabel}>Tripulantes acompanhados</span>
          <strong>{astronauts.length.toString().padStart(2, '0')}</strong>
          <span className={styles.overviewMeta}>Dados recebidos pela missão</span>
        </article>
        <article className={styles.overviewCard}>
          <span className={styles.overviewLabel}>Prioridade</span>
          <strong>{currentAlertCount.toString().padStart(2, '0')}</strong>
          <span className={styles.overviewMeta}>Requer revisão de acordo com o protocolo</span>
        </article>
        <article className={styles.overviewCard}>
          <span className={styles.overviewLabel}>Atenção</span>
          <strong>{attentionCount.toString().padStart(2, '0')}</strong>
          <span className={styles.overviewMeta}>Manter sob acompanhamento</span>
        </article>
      </section>

      <div className={styles.grid}>
        <section className={styles.crewList} aria-labelledby="crew-heading">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.sectionIndex}>01 / TRIPULAÇÃO</span>
              <h2 id="crew-heading">Tripulação monitorizada</h2>
            </div>
            <span className={styles.crewCount}>{astronauts.length}</span>
          </div>
          {astronauts.length === 0 ? (
            <p className={styles.emptyHint}>Não há astronautas disponíveis para acompanhamento.</p>
          ) : (
            <ul className={styles.items}>
              {astronauts.map((astronaut, index) => {
                const isSelected = astronaut.id === selectedId;
                const latest = latestFor(astronaut.id);
                const alert = alertFor(astronaut.id);

                return (
                  <li key={astronaut.id} className={styles.crewListItem}>
                    <button
                      type="button"
                      className={`${styles.item} ${isSelected ? styles.selected : ''}`}
                      onClick={() => selectAstronaut(astronaut.id)}
                      aria-pressed={isSelected}
                    >
                      <span className={styles.crewIndex}>{String(index + 1).padStart(2, '0')}</span>
                      <span className={styles.info}>
                        <strong>{astronaut.name}</strong>
                        <span className={styles.mission}>{astronaut.mission}</span>
                      </span>
                      <span className={styles.status}>
                        {loading.summaries && !latest ? (
                          <span className={styles.crewStatusLoading}>A carregar…</span>
                        ) : errorsById[astronaut.id] && !latest ? (
                          <AlertBadge level="Indisponível" />
                        ) : (
                          <AlertBadge level={alert?.level || 'Não avaliado'} />
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className={styles.teamNote}>
            Mission Control representa a equipa de acompanhamento em Terra, não um astronauta.
          </p>
        </section>

        <section className={styles.detail} aria-labelledby="detail-heading">
          {!selectedId ? (
            <div className={styles.emptyState}>
              <span className={styles.detailIndex}>02 / REGISTO</span>
              <p>Selecione um membro da tripulação para consultar o resumo e os registos da missão.</p>
            </div>
          ) : (
            <>
              <div className={styles.detailHeader}>
                <div>
                  <span className={styles.sectionIndex}>RESUMO DO ASTRONAUTA</span>
                  <h2 id="detail-heading">
                    {astronauts.find((person) => person.id === selectedId)?.name}
                  </h2>
                </div>
                <AlertBadge level={alertFor(selectedId)?.level || 'Não avaliado'} />
              </div>

              {loading.selected && !summaries[selectedId] ? (
                <LoadingSpinner message="A carregar resumo da missão…" />
              ) : latestFor(selectedId) ? (
                <div className={styles.detailMetrics}>
                  <MetricCard label="Frequência cardíaca" value={latestFor(selectedId).heartRate} unit="bpm" />
                  <MetricCard label="Saturação de oxigénio" value={latestFor(selectedId).oxygenSaturation} unit="%" />
                  <MetricCard label="Frequência respiratória" value={latestFor(selectedId).respiratoryRate} unit="/min" />
                  <MetricCard label="Sono" value={latestFor(selectedId).sleepHours} unit="h" />
                  <MetricCard label="Qualidade do sono" value={latestFor(selectedId).sleepQuality} unit="/10" />
                  <MetricCard label="Stress" value={latestFor(selectedId).stressLevel} unit="/10" />
                  <MetricCard label="Fadiga" value={latestFor(selectedId).fatigueLevel} unit="/10" />
                  <MetricCard label="Sensação de isolamento" value={latestFor(selectedId).isolationLevel} unit="/10" />
                  <MetricCard label="Qualidade da concentração" value={latestFor(selectedId).concentrationLevel} unit="/10" />
                  <MetricCard label="Motivação" value={latestFor(selectedId).motivationLevel} unit="/10" />
                  <MetricCard label="Humor" value={latestFor(selectedId).mood} />
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <p>Sem medições recentes. O estado deste astronauta não foi avaliado.</p>
                </div>
              )}

              {(retryError || errorsById[selectedId]) && (
                <div className={styles.retryBanner} role="alert">
                  <span>{retryError || errorsById[selectedId]}</span>
                  <button type="button" className={styles.retryBtn} onClick={() => selectAstronaut(selectedId)}>
                    Repetir
                  </button>
                </div>
              )}

              {alertFor(selectedId) && (
                <div className={styles.detailAlert}>
                  <span className={styles.sectionIndex}>SINALIZAÇÃO DO SISTEMA</span>
                  <h3>{alertFor(selectedId).title}</h3>
                  <p>{alertFor(selectedId).description}</p>
                  {alertFor(selectedId).signals?.length > 0 && (
                    <ul>
                      {alertFor(selectedId).signals.map((signal) => (
                        <li key={signal.metric}>
                          {signal.label}: últimos {signal.consecutiveReadings} registos {signal.direction} da baseline
                          ({signal.latestValue} {signal.unit}; referência {signal.baselineValue} {signal.unit}).
                        </li>
                      ))}
                    </ul>
                  )}
                  {alertFor(selectedId).recommendations?.map((recommendation) => (
                    <p key={recommendation}>{recommendation}</p>
                  ))}
                </div>
              )}

              <div className={styles.trendSection}>
                <div className={styles.sectionHeading}>
                  <div>
                    <span className={styles.sectionIndex}>03 / TENDÊNCIA</span>
                    <h2>Tendência de saúde</h2>
                  </div>
                </div>
                <BaselineSummary baseline={summaries[selectedId]?.baseline} />
                {latestFor(selectedId) ? (
                  <div className={styles.trendCharts}>
                    <TrendChart data={summaries[selectedId]?.trend ?? []} metric="sleepHours" />
                    <TrendChart data={summaries[selectedId]?.trend ?? []} metric="heartRate" />
                    <TrendChart data={summaries[selectedId]?.trend ?? []} metric="isolationLevel" />
                    <TrendChart data={summaries[selectedId]?.trend ?? []} metric="concentrationLevel" />
                    <TrendChart data={summaries[selectedId]?.trend ?? []} metric="motivationLevel" />
                    <TrendChart data={summaries[selectedId]?.trend ?? []} metric="sleepQuality" />
                  </div>
                ) : (
                  <p className={styles.emptyHint}>A tendência fica disponível quando houver medições.</p>
                )}
              </div>

              <div className={styles.alertsSection}>
                <div className={styles.sectionHeading}>
                  <div>
                    <span className={styles.sectionIndex}>04 / HISTÓRICO</span>
                    <h2>Histórico da missão</h2>
                  </div>
                  <span className={styles.crewCount}>{historyById[selectedId]?.total ?? '—'}</span>
                </div>
                <p className={styles.historyNote}>
                  Medições, check-ins, sintomas, exercícios e alertas numa cronologia única. Os resultados são paginados
                  e não alteram nem substituem os registos de origem.
                </p>
                {historyError && (
                  <div className={styles.retryBanner} role="alert">
                    <span>{historyError}</span>
                    <button
                      type="button"
                      className={styles.retryBtn}
                      onClick={() => {
                        setHistoryLoading(true);
                        setHistoryError('');
                        setHistoryRequestKey((key) => key + 1);
                      }}
                    >
                      Repetir
                    </button>
                  </div>
                )}
                {historyById[selectedId]?.items?.length ? (
                  <ol className={styles.eventLog} aria-busy={historyLoading}>
                    {historyById[selectedId].items.map((entry) => (
                      <li key={`${entry.kind}-${entry.id}`} className={styles.eventRow}>
                        <span className={styles.eventMarker} aria-hidden="true" />
                        <time className={styles.eventTime} dateTime={entry.occurredAt}>
                          {new Date(entry.occurredAt).toLocaleString('pt-PT')}
                        </time>
                        <div className={styles.eventContent}>
                          <div className={styles.eventTitle}>
                            <strong>{entry.title}</strong>
                            <span className={styles.eventKind}>{{
                              measurement: 'Medição / check-in',
                              alert: 'Alerta',
                              symptom: 'Sintoma',
                              exercise: 'Atividade física',
                            }[entry.kind]}</span>
                            {entry.kind === 'alert' && <AlertBadge level={entry.level} />}
                            {entry.kind === 'symptom' && (
                              <span className={styles.eventKind}>
                                {{ mild: 'Ligeira', moderate: 'Moderada', severe: 'Elevada' }[entry.severity] || 'Gravidade não indicada'}
                              </span>
                            )}
                          </div>
                          {entry.description && <p>{entry.description}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : historyLoading ? (
                  <LoadingSpinner message="A carregar histórico…" />
                ) : (
                  <p className={styles.emptyHint}>Ainda não há eventos no histórico desta pessoa.</p>
                )}
                {historyById[selectedId]?.totalPages > 1 && (
                  <nav className={styles.historyPagination} aria-label="Paginação do histórico">
                    <button
                      type="button"
                      className={styles.refreshButton}
                      disabled={historyLoading || historyPage <= 1}
                      onClick={() => {
                        setHistoryLoading(true);
                        setHistoryError('');
                        setHistoryPage((page) => Math.max(1, page - 1));
                      }}
                    >
                      Anterior
                    </button>
                    <span>Página {historyById[selectedId].page} de {historyById[selectedId].totalPages}</span>
                    <button
                      type="button"
                      className={styles.refreshButton}
                      disabled={historyLoading || historyPage >= historyById[selectedId].totalPages}
                      onClick={() => {
                        setHistoryLoading(true);
                        setHistoryError('');
                        setHistoryPage((page) => page + 1);
                      }}
                    >
                      Seguinte
                    </button>
                  </nav>
                )}
              </div>
              <p className={styles.disclaimer}>
                Os dados apresentados apoiam o acompanhamento da missão e não constituem diagnóstico médico.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

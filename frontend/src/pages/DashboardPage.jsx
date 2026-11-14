import { useEffect, useState } from 'react';
import styles from './DashboardPage.module.css';
import { api } from '../lib/api.js';
import AstronautSelector from '../components/AstronautSelector.jsx';
import AlertBadge from '../components/AlertBadge.jsx';
import MetricCard from '../components/MetricCard.jsx';
import TrendChart from '../components/TrendChart.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import CheckinForm from '../components/CheckinForm.jsx';
import MeasurementsForm from '../components/MeasurementsForm.jsx';
import SymptomForm from '../components/SymptomForm.jsx';
import ExerciseForm from '../components/ExerciseForm.jsx';
import BaselineSummary from '../components/BaselineSummary.jsx';

const METRIC_LABELS = {
  heartRate: 'Frequência cardíaca',
  oxygenSaturation: 'Saturação de oxigénio',
  respiratoryRate: 'Frequência respiratória',
  sleepHours: 'Sono',
  stressLevel: 'Stress',
  fatigueLevel: 'Fadiga',
  isolationLevel: 'Isolamento',
  concentrationLevel: 'Concentração',
  motivationLevel: 'Motivação',
  sleepQuality: 'Qualidade do sono',
  mood: 'Humor',
};

const METRIC_UNITS = {
  heartRate: 'bpm',
  oxygenSaturation: '%',
  respiratoryRate: '/min',
  sleepHours: 'h',
  stressLevel: '/10',
  fatigueLevel: '/10',
  isolationLevel: '/10',
  concentrationLevel: '/10',
  motivationLevel: '/10',
  sleepQuality: '/10',
};

const SYMPTOM_CATEGORIES = {
  headache: 'Dor de cabeça',
  dizziness: 'Tontura',
  nausea: 'Náusea',
  muscle_pain: 'Dor muscular',
  fatigue: 'Fadiga',
  breathing_difficulty: 'Dificuldade respiratória',
  other: 'Outro sintoma',
};

const SYMPTOM_SEVERITIES = {
  mild: 'ligeira',
  moderate: 'moderada',
  severe: 'elevada',
};

export default function DashboardPage({ initialAstronautId }) {
  const [astronauts, setAstronauts] = useState([]);
  const [selectedId, setSelectedId] = useState(initialAstronautId || '');
  const [summary, setSummary] = useState(null);
  const [exerciseSummary, setExerciseSummary] = useState(null);
  const [exerciseSummaryError, setExerciseSummaryError] = useState('');
  const [exerciseSummaryDays, setExerciseSummaryDays] = useState(7);
  const [alerts, setAlerts] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState({ astronauts: true, summary: false });
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [historyPeriod, setHistoryPeriod] = useState('30');
  const [historyNow, setHistoryNow] = useState(null);
  const [historyType, setHistoryType] = useState('all');

  useEffect(() => {
    const timerId = window.setTimeout(() => setHistoryNow(Date.now()), 0);
    return () => window.clearTimeout(timerId);
  }, [historyPeriod]);

  useEffect(() => {
    const refreshAfterSync = () => setRefreshKey((key) => key + 1);
    window.addEventListener('ahms:offline-synced', refreshAfterSync);
    return () => window.removeEventListener('ahms:offline-synced', refreshAfterSync);
  }, []);

  useEffect(() => {
    let cancelled = false;

    api.listAstronauts()
      .then((data) => {
        if (!cancelled) {
          const crew = (data || []).filter((person) => person.role === 'astronaut');
          setAstronauts(crew);
          setSelectedId((current) => crew.some((person) => person.id === current) ? current : crew[0]?.id || '');
          setLoading((previous) => ({ ...previous, astronauts: false }));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading((previous) => ({ ...previous, astronauts: false }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!selectedId) return;

    let cancelled = false;

    Promise.all([
      api.getSummary(selectedId),
      api.getAlerts(selectedId),
      api.getSymptoms(selectedId),
      api.getExercises(selectedId),
      api.getExerciseSummary(selectedId, exerciseSummaryDays)
        .then((data) => ({ data, error: '' }))
        .catch((summaryError) => ({ data: null, error: summaryError.message })),
    ])
      .then(([sum, alts, symps, activities, activitySummary]) => {
        if (!cancelled) {
          setSummary(sum);
          setExerciseSummary(activitySummary.data);
          setExerciseSummaryError(activitySummary.error);
          setAlerts(alts || []);
          setSymptoms(symps || []);
          setExercises(activities || []);
          setLoading((prev) => ({ ...prev, summary: false }));
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSummary(null);
          setAlerts([]);
          setSymptoms([]);
          setExercises([]);
          setError(err.message);
          setLoading((prev) => ({ ...prev, summary: false }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId, refreshKey, exerciseSummaryDays]);

  const retryLoading = () => {
    setError(null);
    setLoading({ astronauts: true, summary: Boolean(selectedId) });
    setRefreshKey((key) => key + 1);
  };

  const latest = summary?.latest;
  const trend = summary?.trend || [];
  const alert = summary?.alert;
  const activityLog = [
    ...alerts.map((entry) => ({ ...entry, kind: 'alert', occurredAt: entry.created_at })),
    ...symptoms.map((entry) => ({
      ...entry,
      kind: 'symptom',
      occurredAt: entry.timestamp,
      description: [
        `Categoria: ${SYMPTOM_CATEGORIES[entry.category] || 'Outro sintoma'}`,
        `Gravidade indicada: ${SYMPTOM_SEVERITIES[entry.severity] || 'não indicada'}`,
        entry.description,
      ].filter(Boolean).join(' · '),
    })),
    ...trend.map((entry, index) => {
      const observed = [
        ['Frequência cardíaca', entry.heartRate, 'bpm'],
        ['Saturação de oxigénio', entry.oxygenSaturation, '%'],
        ['Frequência respiratória', entry.respiratoryRate, '/min'],
        ['Sono', entry.sleepHours, 'h'],
        ['Stress', entry.stressLevel, '/10'],
        ['Fadiga', entry.fatigueLevel, '/10'],
        ['Sensação de isolamento', entry.isolationLevel, '/10'],
        ['Qualidade da concentração', entry.concentrationLevel, '/10'],
        ['Motivação', entry.motivationLevel, '/10'],
        ['Qualidade do sono', entry.sleepQuality, '/10'],
        ['Humor', entry.mood, ''],
      ].filter(([, value]) => value !== null && value !== undefined);
      return {
        id: `measurement-${entry.date}-${index}`,
        kind: 'measurement',
        title: 'Medição de acompanhamento',
        description: observed.map(([label, value, unit]) => `${label}: ${value} ${unit}`).join(' · '),
        occurredAt: entry.date,
        offlinePending: entry.offlinePending,
      };
    }).filter((entry) => entry.description),
    ...exercises.map((entry) => ({
      ...entry,
      kind: 'exercise',
      title: entry.activity_type,
      description: `${entry.duration_minutes} min · intensidade ${entry.intensity === 'low' ? 'baixa' : entry.intensity === 'high' ? 'alta' : 'moderada'}${entry.fatigue_after === null ? '' : ` · fadiga após exercício ${entry.fatigue_after}/10`}${entry.notes ? ` · ${entry.notes}` : ''}`,
      occurredAt: entry.timestamp,
    })),
  ].sort((left, right) => new Date(right.occurredAt) - new Date(left.occurredAt));
  const periodStart = historyPeriod === 'all' || historyNow === null
    ? null
    : historyNow - Number(historyPeriod) * 24 * 60 * 60 * 1000;
  const filteredActivityLog = activityLog.filter((entry) =>
    (historyType === 'all' || entry.kind === historyType) &&
    (periodStart === null || new Date(entry.occurredAt).getTime() >= periodStart)
  );

  if (loading.astronauts) {
    return <LoadingSpinner message="A carregar astronautas…" />;
  }

  if (error) {
    return (
      <div className={styles.page}>
        <ErrorMessage message={error} onRetry={retryLoading} />
      </div>
    );
  }

  return (
    <div className={`${styles.page} ${styles.dashboardPage}`}>
      <div className={styles.header}>
        <h1>Painel do astronauta</h1>
        <div className={styles.actions}>
          <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={retryLoading}>
            Atualizar
          </button>
        </div>
      </div>

      <div className={`${styles.grid} ${styles.dashboardGrid}`}>
        <aside className={styles.sidebar}>
          <AstronautSelector
            astronauts={astronauts}
            selectedId={selectedId}
            onSelect={setSelectedId}
            loading={loading.astronauts}
          />

          {selectedId && (
            <>
              <section className={styles.cardSection}>
                <h2>Registo de medições</h2>
                <MeasurementsForm astronautId={selectedId} onSuccess={() => setRefreshKey((key) => key + 1)} />
              </section>

              <section className={styles.cardSection}>
                <h2>Check-in diário</h2>
                <CheckinForm astronautId={selectedId} onSuccess={() => setRefreshKey((key) => key + 1)} />
              </section>

              <section className={styles.cardSection}>
                <h2>Sintomas</h2>
                <SymptomForm astronautId={selectedId} onSuccess={() => setRefreshKey((key) => key + 1)} />
              </section>

              <section className={styles.cardSection}>
                <h2>Actividade física</h2>
                <ExerciseForm astronautId={selectedId} onSuccess={() => setRefreshKey((key) => key + 1)} />
              </section>
            </>
          )}
        </aside>

        <main className={styles.main}>
          {!selectedId && (
            <div className={styles.emptyState}>
              <p>Selecione um astronauta para visualizar o seu painel de saúde.</p>
            </div>
          )}

          {selectedId && summary && (
            <>
              <div className={styles.heroMetrics}>
                <div className={styles.statusAlert}>
                  {alert ? (
                    <>
                      <AlertBadge level={alert.level} />
                      <span className={styles.statusTitle}>{alert.title}</span>
                    </>
                  ) : (
                    <span className={styles.statusTitle}>Estado não avaliado — sem dados recentes.</span>
                  )}
                </div>

                {latest && (
                  <>
                    <MetricCard
                      label={METRIC_LABELS.heartRate}
                      value={latest.heartRate}
                      unit={METRIC_UNITS.heartRate}
                    />
                    <MetricCard
                      label={METRIC_LABELS.oxygenSaturation}
                      value={latest.oxygenSaturation}
                      unit={METRIC_UNITS.oxygenSaturation}
                    />
                    <MetricCard
                      label={METRIC_LABELS.respiratoryRate}
                      value={latest.respiratoryRate}
                      unit={METRIC_UNITS.respiratoryRate}
                    />
                    <MetricCard
                      label={METRIC_LABELS.sleepHours}
                      value={latest.sleepHours}
                      unit={METRIC_UNITS.sleepHours}
                    />
                    <MetricCard
                      label={METRIC_LABELS.stressLevel}
                      value={latest.stressLevel}
                      unit={METRIC_UNITS.stressLevel}
                    />
                    <MetricCard
                      label={METRIC_LABELS.fatigueLevel}
                      value={latest.fatigueLevel}
                      unit={METRIC_UNITS.fatigueLevel}
                    />
                    <MetricCard
                      label={METRIC_LABELS.isolationLevel}
                      value={latest.isolationLevel}
                      unit={METRIC_UNITS.isolationLevel}
                    />
                    <MetricCard
                      label={METRIC_LABELS.concentrationLevel}
                      value={latest.concentrationLevel}
                      unit={METRIC_UNITS.concentrationLevel}
                    />
                    <MetricCard
                      label={METRIC_LABELS.motivationLevel}
                      value={latest.motivationLevel}
                      unit={METRIC_UNITS.motivationLevel}
                    />
                    <MetricCard
                      label={METRIC_LABELS.sleepQuality}
                      value={latest.sleepQuality}
                      unit={METRIC_UNITS.sleepQuality}
                    />
                    <MetricCard
                      label={METRIC_LABELS.mood}
                      value={latest.mood}
                    />
                  </>
                )}

                <p className={styles.timestamp}>
                  Última atualização: {latest ? new Date(latest.timestamp).toLocaleString('pt-PT') : '—'}
                </p>
              </div>

              <section className={styles.chartSection}>
                <h2>Tendência histórica</h2>
                <BaselineSummary baseline={summary.baseline} />
                {alert && (
                  <div className={styles.baselineAlert} role="status">
                    <AlertBadge level={alert.level} />
                    <div>
                      <strong>{alert.title}</strong>
                      <p>{alert.description}</p>
                      {alert.signals?.length > 0 && (
                        <ul>
                          {alert.signals.map((signal) => (
                            <li key={signal.metric}>
                              {signal.label}: últimos {signal.consecutiveReadings} registos {signal.direction} da baseline
                              ({signal.latestValue} {signal.unit}; referência {signal.baselineValue} {signal.unit}).
                            </li>
                          ))}
                        </ul>
                      )}
                      {alert.recommendations?.map((recommendation) => (
                        <p key={recommendation}>{recommendation}</p>
                      ))}
                    </div>
                  </div>
                )}
                <div className={styles.chartGrid}>
                  <TrendChart data={trend} metric="sleepHours" />
                  <TrendChart data={trend} metric="heartRate" />
                  <TrendChart data={trend} metric="stressLevel" />
                  <TrendChart data={trend} metric="fatigueLevel" />
                  <TrendChart data={trend} metric="isolationLevel" />
                  <TrendChart data={trend} metric="concentrationLevel" />
                  <TrendChart data={trend} metric="motivationLevel" />
                  <TrendChart data={trend} metric="sleepQuality" />
                </div>
              </section>

              <section className={`${styles.section} ${styles.exerciseSummary}`}>
                <div className={styles.logHeading}>
                  <div>
                    <span className={styles.logKicker}>ROTINA FÍSICA</span>
                    <h2>Resumo de atividade</h2>
                  </div>
                  <label className={styles.periodControl}>
                    <span>Período</span>
                    <select
                      value={exerciseSummaryDays}
                      onChange={(event) => setExerciseSummaryDays(Number(event.target.value))}
                    >
                      <option value="7">7 dias</option>
                      <option value="30">30 dias</option>
                    </select>
                  </label>
                </div>
                <div className={styles.exerciseStats}>
                  <div>
                    <span>Sessões registadas</span>
                    <strong>{exerciseSummary?.sessions ?? '—'}</strong>
                    {(exerciseSummary?.pendingLocalSessions ?? 0) > 0 && (
                      <small>{exerciseSummary.pendingLocalSessions} por sincronizar</small>
                    )}
                  </div>
                  <div>
                    <span>Tempo registado</span>
                    <strong>{exerciseSummary ? `${exerciseSummary.totalMinutes} min` : '—'}</strong>
                    {(exerciseSummary?.pendingLocalMinutes ?? 0) > 0 && (
                      <small>{exerciseSummary.pendingLocalMinutes} min locais pendentes</small>
                    )}
                  </div>
                  <div>
                    <span>Dias com atividade</span>
                    <strong>{exerciseSummary?.activeDays ?? '—'}</strong>
                  </div>
                  <div>
                    <span>Duração média</span>
                    <strong>
                      {exerciseSummary?.averageDurationMinutes === null || exerciseSummary?.averageDurationMinutes === undefined
                        ? '—'
                        : `${exerciseSummary.averageDurationMinutes} min`}
                    </strong>
                  </div>
                </div>
                <p className={styles.summaryNote}>
                  {exerciseSummaryError
                    ? `Resumo indisponível: ${exerciseSummaryError}`
                    : 'Valores calculados a partir dos registos confirmados no servidor e disponíveis neste dispositivo. As entradas locais pendentes são apresentadas à parte.'}
                </p>
              </section>

              <section className={`${styles.section} ${styles.logSection}`}>
                <div className={styles.logHeading}>
                  <div>
                    <span className={styles.logKicker}>REGISTO DE MISSÃO</span>
                    <h2>Histórico e eventos</h2>
                  </div>
                  <span className={styles.logCount}>
                    {filteredActivityLog.length} de {activityLog.length} eventos
                  </span>
                </div>
                <div className={styles.historyFilters}>
                  <label className={styles.periodControl}>
                    <span>Período</span>
                    <select value={historyPeriod} onChange={(event) => setHistoryPeriod(event.target.value)}>
                      <option value="7">Últimos 7 dias</option>
                      <option value="30">Últimos 30 dias</option>
                      <option value="all">Todos os disponíveis</option>
                    </select>
                  </label>
                  <label className={styles.periodControl}>
                    <span>Tipo de evento</span>
                    <select value={historyType} onChange={(event) => setHistoryType(event.target.value)}>
                      <option value="all">Todos os tipos</option>
                      <option value="measurement">Medições</option>
                      <option value="alert">Alertas</option>
                      <option value="symptom">Sintomas</option>
                      <option value="exercise">Atividade física</option>
                    </select>
                  </label>
                </div>
                <p className={styles.summaryNote}>
                  A cronologia reúne até 90 medições e até 100 registos de cada tipo disponibilizados pela API. “Todos os disponíveis” não garante o histórico completo.
                </p>
                {filteredActivityLog.length > 0 ? (
                  <ol className={styles.eventLog}>
                    {filteredActivityLog.map((entry) => (
                      <li
                        key={`${entry.kind}-${entry.id}`}
                        className={styles.eventRow}
                      >
                        <span
                          className={`${styles.eventMarker} ${entry.kind === 'alert' ? styles.alertMarker : entry.kind === 'exercise' ? styles.exerciseMarker : entry.kind === 'measurement' ? styles.measurementMarker : styles.symptomMarker}`}
                          aria-hidden="true"
                        />
                        <time className={styles.eventTime} dateTime={entry.occurredAt}>
                          {new Date(entry.occurredAt).toLocaleString('pt-PT')}
                        </time>
                        <div className={styles.eventContent}>
                          <div className={styles.eventTitle}>
                            <strong>{entry.title}</strong>
                            {entry.offlinePending ? (
                              <span className={styles.eventType}>Por sincronizar</span>
                            ) : entry.kind === 'alert' ? (
                              <AlertBadge level={entry.level} />
                            ) : entry.kind === 'exercise' ? (
                              <span className={styles.eventType}>Exercício</span>
                            ) : entry.kind === 'measurement' ? (
                              <span className={styles.eventType}>Medição</span>
                            ) : (
                              <span className={styles.eventType}>Sintoma</span>
                            )}
                          </div>
                          <p>{entry.description || 'Registo sem observação adicional.'}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className={styles.emptyHint}>
                    {activityLog.length
                      ? 'Não há eventos deste tipo no período selecionado.'
                      : 'Ainda não existem medições, alertas, sintomas ou atividades no histórico disponível.'}
                  </p>
                )}
              </section>
            </>
          )}
        </main>
      </div>

      <footer className={styles.footer}>
        <p className={styles.disclaimer}>
          O AHMS é uma ferramenta de acompanhamento de saúde desenvolvida pela startup Innotech.
          Não substitui profissionais de saúde nem fornece diagnósticos médicos.
        </p>
      </footer>
    </div>
  );
}

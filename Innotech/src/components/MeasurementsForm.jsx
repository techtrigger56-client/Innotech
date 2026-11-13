import { useState } from 'react';
import styles from './Form.module.css';
import { api } from '../lib/api.js';

const MOODS = ['Normal', 'Bom', 'Razoável', 'Baixo'];

export default function MeasurementsForm({ astronautId, onSuccess }) {
  const [form, setForm] = useState({
    heartRate: '',
    oxygenSaturation: '',
    respiratoryRate: '',
    sleepHours: '',
    stressLevel: '',
    fatigueLevel: '',
    mood: 'Normal',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState(null);

  const validate = () => {
    const newErrors = {};

    const fields = [
      { key: 'heartRate', label: 'Frequência cardíaca', min: 30, max: 220 },
      { key: 'oxygenSaturation', label: 'Saturação de oxigénio', min: 70, max: 100 },
      { key: 'respiratoryRate', label: 'Frequência respiratória', min: 6, max: 60 },
      { key: 'sleepHours', label: 'Horas de sono', min: 0, max: 24 },
      { key: 'stressLevel', label: 'Stress', min: 0, max: 10 },
      { key: 'fatigueLevel', label: 'Fadiga', min: 0, max: 10 },
    ];

    fields.forEach(({ key, label, min, max }) => {
      const val = Number(form[key]);
      if (!form[key] || !Number.isFinite(val) || val < min || val > max) {
        newErrors[key] = `${label} deve estar entre ${min} e ${max}.`;
      }
    });

    if (!form.mood) {
      newErrors.mood = 'Selecione o humor.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitMessage(null);

    if (!validate()) return;

    setSubmitting(true);
    try {
      const result = await api.postMeasurements(astronautId, {
        heartRate: Number(form.heartRate),
        oxygenSaturation: Number(form.oxygenSaturation),
        respiratoryRate: Number(form.respiratoryRate),
        sleepHours: Number(form.sleepHours),
        stressLevel: Number(form.stressLevel),
        fatigueLevel: Number(form.fatigueLevel),
        mood: form.mood,
      });
      setSubmitMessage({
        type: 'success',
        text: result?.queued
          ? 'Medições guardadas cifradas neste dispositivo; aguardam sincronização.'
          : 'Medições registadas com sucesso.',
      });
      if (onSuccess) onSuccess();
    } catch (error) {
      setSubmitMessage({
        type: 'error',
        text: error.message || 'Erro ao registar medições.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const btnClass = `${styles.btn} ${styles.primary}`;

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h2>Registo de medições</h2>
      <p className={styles.note}>
        Insira os seus indicadores fisiológicos mais recentes. Estes dados são usados para
        acompanhamento e não constituem um diagnóstico médico.
      </p>

      <div className={styles.grid}>
        <div className={styles.field}>
          <label htmlFor="meas-hr">
            Frequência cardíaca (bpm)<span className={styles.required} aria-hidden="true">*</span>
          </label>
          <input
            id="meas-hr"
            type="number"
            min="30"
            max="220"
            value={form.heartRate}
            onChange={(e) => handleChange('heartRate', e.target.value)}
            aria-invalid={!!errors.heartRate}
            aria-describedby={errors.heartRate ? 'meas-hr-error' : undefined}
          />
          {errors.heartRate && (
            <p id="meas-hr-error" className={styles.error} role="alert">
              {errors.heartRate}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="meas-spo2">
            Saturação de oxigénio (%)<span className={styles.required} aria-hidden="true">*</span>
          </label>
          <input
            id="meas-spo2"
            type="number"
            min="70"
            max="100"
            value={form.oxygenSaturation}
            onChange={(e) => handleChange('oxygenSaturation', e.target.value)}
            aria-invalid={!!errors.oxygenSaturation}
            aria-describedby={errors.oxygenSaturation ? 'meas-spo2-error' : undefined}
          />
          {errors.oxygenSaturation && (
            <p id="meas-spo2-error" className={styles.error} role="alert">
              {errors.oxygenSaturation}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="meas-rr">
            Frequência respiratória (/min)<span className={styles.required} aria-hidden="true">*</span>
          </label>
          <input
            id="meas-rr"
            type="number"
            min="6"
            max="60"
            value={form.respiratoryRate}
            onChange={(e) => handleChange('respiratoryRate', e.target.value)}
            aria-invalid={!!errors.respiratoryRate}
            aria-describedby={errors.respiratoryRate ? 'meas-rr-error' : undefined}
          />
          {errors.respiratoryRate && (
            <p id="meas-rr-error" className={styles.error} role="alert">
              {errors.respiratoryRate}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="meas-sleep">
            Horas de sono<span className={styles.required} aria-hidden="true">*</span>
          </label>
          <input
            id="meas-sleep"
            type="number"
            min="0"
            max="24"
            step="0.5"
            value={form.sleepHours}
            onChange={(e) => handleChange('sleepHours', e.target.value)}
            aria-invalid={!!errors.sleepHours}
            aria-describedby={errors.sleepHours ? 'meas-sleep-error' : undefined}
          />
          {errors.sleepHours && (
            <p id="meas-sleep-error" className={styles.error} role="alert">
              {errors.sleepHours}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="meas-stress">
            Stress (0–10)<span className={styles.required} aria-hidden="true">*</span>
          </label>
          <input
            id="meas-stress"
            type="number"
            min="0"
            max="10"
            value={form.stressLevel}
            onChange={(e) => handleChange('stressLevel', e.target.value)}
            aria-invalid={!!errors.stressLevel}
            aria-describedby={errors.stressLevel ? 'meas-stress-error' : undefined}
          />
          {errors.stressLevel && (
            <p id="meas-stress-error" className={styles.error} role="alert">
              {errors.stressLevel}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="meas-fatigue">
            Fadiga (0–10)<span className={styles.required} aria-hidden="true">*</span>
          </label>
          <input
            id="meas-fatigue"
            type="number"
            min="0"
            max="10"
            value={form.fatigueLevel}
            onChange={(e) => handleChange('fatigueLevel', e.target.value)}
            aria-invalid={!!errors.fatigueLevel}
            aria-describedby={errors.fatigueLevel ? 'meas-fatigue-error' : undefined}
          />
          {errors.fatigueLevel && (
            <p id="meas-fatigue-error" className={styles.error} role="alert">
              {errors.fatigueLevel}
            </p>
          )}
        </div>

        <div className={`${styles.field} ${styles.full}`}>
          <label htmlFor="meas-mood">
            Humor<span className={styles.required} aria-hidden="true">*</span>
          </label>
          <select
            id="meas-mood"
            value={form.mood}
            onChange={(e) => handleChange('mood', e.target.value)}
            aria-invalid={!!errors.mood}
            aria-describedby={errors.mood ? 'meas-mood-error' : undefined}
          >
            {MOODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {errors.mood && (
            <p id="meas-mood-error" className={styles.error} role="alert">
              {errors.mood}
            </p>
          )}
        </div>
      </div>

      {submitMessage && (
        <div className={`${styles.submitMessage} ${styles[submitMessage.type]}`} role="alert" aria-live="polite">
          {submitMessage.text}
        </div>
      )}

      <button
        type="submit"
        className={btnClass}
        disabled={submitting}
        aria-busy={submitting}
      >
        {submitting ? 'A registar…' : 'Registar medições'}
      </button>
    </form>
  );
}

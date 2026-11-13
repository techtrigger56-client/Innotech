import { useState } from 'react';
import styles from './Form.module.css';
import { api } from '../lib/api.js';

const MOODS = ['Normal', 'Bom', 'Razoável', 'Baixo'];
const OPTIONAL_RATINGS = [
  { field: 'isolationLevel', id: 'checkin-isolation', label: 'Sensação de isolamento' },
  { field: 'concentrationLevel', id: 'checkin-concentration', label: 'Qualidade da concentração' },
  { field: 'motivationLevel', id: 'checkin-motivation', label: 'Motivação' },
  { field: 'sleepQuality', id: 'checkin-sleep-quality', label: 'Qualidade do sono' },
];

export default function CheckinForm({ astronautId, onSuccess }) {
  const [form, setForm] = useState({
    sleepHours: '',
    stressLevel: '',
    fatigueLevel: '',
    isolationLevel: '',
    concentrationLevel: '',
    motivationLevel: '',
    sleepQuality: '',
    mood: 'Normal',
    note: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState(null);

  const validate = () => {
    const newErrors = {};

    if (!form.sleepHours || Number(form.sleepHours) < 0 || Number(form.sleepHours) > 24) {
      newErrors.sleepHours = 'Horas de sono devem estar entre 0 e 24.';
    }
    if (!form.stressLevel || Number(form.stressLevel) < 0 || Number(form.stressLevel) > 10) {
      newErrors.stressLevel = 'Stress deve estar entre 0 e 10.';
    }
    if (!form.fatigueLevel || Number(form.fatigueLevel) < 0 || Number(form.fatigueLevel) > 10) {
      newErrors.fatigueLevel = 'Fadiga deve estar entre 0 e 10.';
    }
    for (const { field, label } of OPTIONAL_RATINGS) {
      if (form[field] !== '' && (Number(form[field]) < 0 || Number(form[field]) > 10)) {
        newErrors[field] = `${label} deve estar entre 0 e 10.`;
      }
    }
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
      const result = await api.postCheckin(astronautId, {
        sleepHours: Number(form.sleepHours),
        stressLevel: Number(form.stressLevel),
        fatigueLevel: Number(form.fatigueLevel),
        isolationLevel: form.isolationLevel === '' ? undefined : Number(form.isolationLevel),
        concentrationLevel: form.concentrationLevel === '' ? undefined : Number(form.concentrationLevel),
        motivationLevel: form.motivationLevel === '' ? undefined : Number(form.motivationLevel),
        sleepQuality: form.sleepQuality === '' ? undefined : Number(form.sleepQuality),
        mood: form.mood,
        note: form.note || undefined,
      });
      setSubmitMessage({
        type: 'success',
        text: result?.queued
          ? 'Check-in guardado cifrado neste dispositivo; aguarda sincronização.'
          : 'Check-in registado com sucesso.',
      });
      if (onSuccess) onSuccess();
    } catch (error) {
      setSubmitMessage({
        type: 'error',
        text: error.message || 'Erro ao registar check-in.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const btnClass = `${styles.btn} ${styles.primary}`;

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h2>Check-in diário</h2>
      <p className={styles.note}>
        Escalas opcionais de 0 a 10: um valor maior indica mais sensação de isolamento e melhor qualidade
        de concentração, motivação ou sono. Registo de acompanhamento, não diagnóstico médico.
      </p>

      <div className={styles.grid}>
        <div className={styles.field}>
          <label htmlFor="checkin-sleep">
            Horas de sono<span className={styles.required} aria-hidden="true">*</span>
          </label>
          <input
            id="checkin-sleep"
            type="number"
            min="0"
            max="24"
            step="0.5"
            value={form.sleepHours}
            onChange={(e) => handleChange('sleepHours', e.target.value)}
            aria-invalid={!!errors.sleepHours}
            aria-describedby={errors.sleepHours ? 'checkin-sleep-error' : undefined}
          />
          {errors.sleepHours && (
            <p id="checkin-sleep-error" className={styles.error} role="alert">
              {errors.sleepHours}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="checkin-stress">
            Stress (0–10)<span className={styles.required} aria-hidden="true">*</span>
          </label>
          <input
            id="checkin-stress"
            type="number"
            min="0"
            max="10"
            value={form.stressLevel}
            onChange={(e) => handleChange('stressLevel', e.target.value)}
            aria-invalid={!!errors.stressLevel}
            aria-describedby={errors.stressLevel ? 'checkin-stress-error' : undefined}
          />
          {errors.stressLevel && (
            <p id="checkin-stress-error" className={styles.error} role="alert">
              {errors.stressLevel}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="checkin-fatigue">
            Fadiga (0–10)<span className={styles.required} aria-hidden="true">*</span>
          </label>
          <input
            id="checkin-fatigue"
            type="number"
            min="0"
            max="10"
            value={form.fatigueLevel}
            onChange={(e) => handleChange('fatigueLevel', e.target.value)}
            aria-invalid={!!errors.fatigueLevel}
            aria-describedby={errors.fatigueLevel ? 'checkin-fatigue-error' : undefined}
          />
          {errors.fatigueLevel && (
            <p id="checkin-fatigue-error" className={styles.error} role="alert">
              {errors.fatigueLevel}
            </p>
          )}
        </div>

        {OPTIONAL_RATINGS.map(({ field, id, label }) => (
          <div className={styles.field} key={field}>
            <label htmlFor={id}>{label} (0–10)</label>
            <input
              id={id}
              type="number"
              min="0"
              max="10"
              value={form[field]}
              onChange={(event) => handleChange(field, event.target.value)}
              aria-invalid={!!errors[field]}
              aria-describedby={errors[field] ? `${id}-error` : undefined}
            />
            {errors[field] && (
              <p id={`${id}-error`} className={styles.error} role="alert">
                {errors[field]}
              </p>
            )}
          </div>
        ))}

        <div className={`${styles.field} ${styles.full}`}>
          <label htmlFor="checkin-mood">
            Humor<span className={styles.required} aria-hidden="true">*</span>
          </label>
          <select
            id="checkin-mood"
            value={form.mood}
            onChange={(e) => handleChange('mood', e.target.value)}
            aria-invalid={!!errors.mood}
            aria-describedby={errors.mood ? 'checkin-mood-error' : undefined}
          >
            {MOODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {errors.mood && (
            <p id="checkin-mood-error" className={styles.error} role="alert">
              {errors.mood}
            </p>
          )}
        </div>

        <div className={`${styles.field} ${styles.full}`}>
          <label htmlFor="checkin-note">Observação (opcional)</label>
          <textarea
            id="checkin-note"
            rows="3"
            maxLength="500"
            value={form.note}
            onChange={(e) => handleChange('note', e.target.value)}
            placeholder="Adicione notas opcionais sobre o seu estado…"
          />
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
        {submitting ? 'A registar…' : 'Registar check-in'}
      </button>
    </form>
  );
}

import { useState } from 'react';
import styles from './Form.module.css';
import { api } from '../lib/api.js';

const INITIAL_FORM = {
  activityType: '',
  durationMinutes: '',
  intensity: 'moderate',
  fatigueAfter: '',
  notes: '',
};

export default function ExerciseForm({ astronautId, onSuccess }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage(null);

    if (!form.activityType.trim() || !form.durationMinutes || Number(form.durationMinutes) < 1 || Number(form.durationMinutes) > 600) {
      setMessage({ type: 'error', text: 'Indique a actividade e uma duração entre 1 e 600 minutos.' });
      return;
    }

    if (form.fatigueAfter !== '' && (Number(form.fatigueAfter) < 0 || Number(form.fatigueAfter) > 10)) {
      setMessage({ type: 'error', text: 'A fadiga após exercício deve estar entre 0 e 10.' });
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.postExercise(astronautId, {
        ...form,
        durationMinutes: Number(form.durationMinutes),
        fatigueAfter: form.fatigueAfter === '' ? undefined : Number(form.fatigueAfter),
      });
      setForm(INITIAL_FORM);
      setMessage({
        type: 'success',
        text: result?.queued
          ? 'Actividade guardada cifrada neste dispositivo; aguarda sincronização.'
          : 'Actividade física guardada no histórico.',
      });
      onSuccess?.();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Não foi possível registar a actividade.' });
    } finally {
      setSubmitting(false);
    }
  };

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2>Registar exercício</h2>
      <p className={styles.note}>Registe a actividade realizada e, se desejar, a fadiga sentida depois.</p>

      <div className={styles.grid}>
        <div className={`${styles.field} ${styles.full}`}>
          <label htmlFor="exercise-type">Tipo de actividade</label>
          <input
            id="exercise-type"
            value={form.activityType}
            maxLength="80"
            onChange={(event) => update('activityType', event.target.value)}
            placeholder="Ex.: bicicleta ergométrica"
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="exercise-duration">Duração (minutos)</label>
          <input
            id="exercise-duration"
            type="number"
            min="1"
            max="600"
            value={form.durationMinutes}
            onChange={(event) => update('durationMinutes', event.target.value)}
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="exercise-intensity">Intensidade</label>
          <select
            id="exercise-intensity"
            value={form.intensity}
            onChange={(event) => update('intensity', event.target.value)}
          >
            <option value="low">Baixa</option>
            <option value="moderate">Moderada</option>
            <option value="high">Alta</option>
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="exercise-fatigue">Fadiga depois (0–10)</label>
          <input
            id="exercise-fatigue"
            type="number"
            min="0"
            max="10"
            value={form.fatigueAfter}
            onChange={(event) => update('fatigueAfter', event.target.value)}
          />
        </div>

        <div className={`${styles.field} ${styles.full}`}>
          <label htmlFor="exercise-notes">Observação (opcional)</label>
          <textarea
            id="exercise-notes"
            rows="2"
            maxLength="500"
            value={form.notes}
            onChange={(event) => update('notes', event.target.value)}
          />
        </div>
      </div>

      {message && (
        <div className={`${styles.submitMessage} ${styles[message.type]}`} role="status" aria-live="polite">
          {message.text}
        </div>
      )}

      <button className={`${styles.btn} ${styles.primary}`} type="submit" disabled={submitting}>
        {submitting ? 'A registar…' : 'Guardar actividade'}
      </button>
    </form>
  );
}

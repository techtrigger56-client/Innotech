import { useState } from 'react';
import styles from './Form.module.css';
import { api } from '../lib/api.js';

const CATEGORIES = [
  { value: 'headache', label: 'Dor de cabeça' },
  { value: 'dizziness', label: 'Tontura' },
  { value: 'nausea', label: 'Náusea' },
  { value: 'muscle_pain', label: 'Dor muscular' },
  { value: 'fatigue', label: 'Fadiga' },
  { value: 'breathing_difficulty', label: 'Dificuldade respiratória' },
  { value: 'other', label: 'Outro sintoma' },
];

export default function SymptomForm({ astronautId, onSuccess }) {
  const [form, setForm] = useState({ category: 'headache', title: '', severity: 'moderate', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage(null);

    if (form.category === 'other' && !form.title.trim()) {
      setMessage({ type: 'error', text: 'Descreva o outro sintoma a registar.' });
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.postSymptom(astronautId, form);
      setForm({ category: 'headache', title: '', severity: 'moderate', description: '' });
      setMessage({
        type: 'success',
        text: result?.queued
          ? 'Sintoma guardado cifrado neste dispositivo; aguarda sincronização.'
          : 'Sintoma registado no histórico.',
      });
      onSuccess?.();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Não foi possível registar o sintoma.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2>Registar sintoma</h2>
      <p className={styles.note}>O registo fica associado ao histórico deste astronauta.</p>

      <div className={styles.grid}>
        <div className={`${styles.field} ${styles.full}`}>
          <label htmlFor="symptom-category">Categoria do sintoma</label>
          <select
            id="symptom-category"
            value={form.category}
            onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
          >
            {CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>{category.label}</option>
            ))}
          </select>
        </div>

        {form.category === 'other' && (
          <div className={`${styles.field} ${styles.full}`}>
            <label htmlFor="symptom-title">Descreva o sintoma</label>
            <input
              id="symptom-title"
              value={form.title}
              maxLength="80"
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              required
              placeholder="Indique o sintoma"
            />
          </div>
        )}

        <div className={`${styles.field} ${styles.full}`}>
          <label htmlFor="symptom-severity">Gravidade indicada</label>
          <select
            id="symptom-severity"
            value={form.severity}
            onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value }))}
          >
            <option value="mild">Ligeira</option>
            <option value="moderate">Moderada</option>
            <option value="severe">Elevada</option>
          </select>
        </div>

        <div className={`${styles.field} ${styles.full}`}>
          <label htmlFor="symptom-description">Observação (opcional)</label>
          <textarea
            id="symptom-description"
            rows="3"
            maxLength="500"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          />
        </div>
      </div>

      {message && (
        <div className={`${styles.submitMessage} ${styles[message.type]}`} role="status" aria-live="polite">
          {message.text}
        </div>
      )}

      <button className={`${styles.btn} ${styles.primary}`} type="submit" disabled={submitting}>
        {submitting ? 'A registar…' : 'Guardar sintoma'}
      </button>
    </form>
  );
}

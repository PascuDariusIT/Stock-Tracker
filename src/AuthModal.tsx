import { useState } from 'react';

export interface UserData {
  username: string;
  email: string;
}

interface AuthModalProps {
  initialMode: 'login' | 'register';
  onClose: () => void;
  onSuccess: (user: UserData) => void;
}

export function AuthModal({ initialMode, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (mode === 'register' && username.trim().length < 3) {
      newErrors.username = 'Numele trebuie să conțină cel puțin 3 caractere.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      newErrors.email = 'Introdu o adresă de email validă (ex: nume@domeniu.com).';
    }

    if (password.length < 6) {
      newErrors.password = 'Parola trebuie să aibă minim 6 caractere.';
    }

    if (mode === 'register' && password !== confirmPassword) {
      newErrors.confirmPassword = 'Parolele nu coincid.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload =
        mode === 'login'
          ? { email: email.trim(), password }
          : { username: username.trim(), email: email.trim(), password };

      const res = await fetch(`http://localhost:8000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setServerError(data.detail || 'A apărut o eroare la autentificare.');
      } else {
        onSuccess(data.user);
        onClose();
      }
    } catch {
      setServerError('Nu s-a putut contacta serverul.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
      }}
    >
      <div
        style={{
          backgroundColor: '#1e293b',
          padding: '28px',
          borderRadius: '12px',
          border: '1px solid #334155',
          width: '100%',
          maxWidth: '400px',
          color: '#f8fafc',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#38bdf8', fontSize: '20px' }}>
            {mode === 'login' ? '🔐 Autentificare' : '📝 Creare Cont Nou'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '20px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {serverError && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              padding: '10px',
              borderRadius: '6px',
              fontSize: '13px',
              marginBottom: '15px',
            }}
          >
            ⚠️ {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {mode === 'register' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '4px' }}>
                Nume Utilizator
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ex: dariuspascu"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px',
                  borderRadius: '6px',
                  border: errors.username ? '1px solid #ef4444' : '1px solid #334155',
                  backgroundColor: '#0f172a',
                  color: '#fff',
                }}
              />
              {errors.username && <span style={{ color: '#ef4444', fontSize: '12px' }}>{errors.username}</span>}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '4px' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nume@exemplu.com"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px',
                borderRadius: '6px',
                border: errors.email ? '1px solid #ef4444' : '1px solid #334155',
                backgroundColor: '#0f172a',
                color: '#fff',
              }}
            />
            {errors.email && <span style={{ color: '#ef4444', fontSize: '12px' }}>{errors.email}</span>}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '4px' }}>Parolă</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minim 6 caractere"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px',
                borderRadius: '6px',
                border: errors.password ? '1px solid #ef4444' : '1px solid #334155',
                backgroundColor: '#0f172a',
                color: '#fff',
              }}
            />
            {errors.password && <span style={{ color: '#ef4444', fontSize: '12px' }}>{errors.password}</span>}
          </div>

          {mode === 'register' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '4px' }}>
                Confirmă Parola
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repetă parola"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px',
                  borderRadius: '6px',
                  border: errors.confirmPassword ? '1px solid #ef4444' : '1px solid #334155',
                  backgroundColor: '#0f172a',
                  color: '#fff',
                }}
              />
              {errors.confirmPassword && (
                <span style={{ color: '#ef4444', fontSize: '12px' }}>{errors.confirmPassword}</span>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: '6px',
              backgroundColor: '#38bdf8',
              color: '#0f172a',
              border: 'none',
              padding: '12px',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: submitting ? 'wait' : 'pointer',
            }}
          >
            {submitting ? 'Se procesează...' : mode === 'login' ? 'Intră în Cont' : 'Înregistrează-te'}
          </button>
        </form>

        <p style={{ marginTop: '16px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>
          {mode === 'login' ? 'Nu ai cont încă? ' : 'Ai deja un cont? '}
          <span
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setErrors({});
              setServerError('');
            }}
            style={{ color: '#38bdf8', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {mode === 'login' ? 'Creează unul acum' : 'Autentifică-te'}
          </span>
        </p>
      </div>
    </div>
  );
}

export default AuthModal;
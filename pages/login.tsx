import { useState } from 'react';
import { useRouter } from 'next/router';
import styles from './login.module.css';

export default function Login() {
  const [password, setPassword] = useState('');
  const router = useRouter();
  const urlParams = new URLSearchParams(window.location.search);
  const wrongPassword = urlParams.get('wrong') === 'true';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const expires = new Date();
    expires.setMonth(expires.getMonth() + 6);
    document.cookie = `page-password=${password}; expires=${expires.toUTCString()}; path=/`;
    router.push('/');
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Login</h1>
      <form onSubmit={handleSubmit} className={styles.form}>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" className={styles.input} />
        <button type="submit" className={styles.button}>
          Submit
        </button>
        {wrongPassword && <p className={styles.error}>Wrong password</p>}
      </form>
    </div>
  );
}

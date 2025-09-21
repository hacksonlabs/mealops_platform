import { useEffect, useState } from 'react';

export default function useHeaderSearch() {
  const [query, setQuery] = useState('');
  useEffect(() => {
    const onSearchUpdate = (e) => setQuery(e?.detail?.query ?? '');
    window.addEventListener('searchUpdate', onSearchUpdate);
    return () => window.removeEventListener('searchUpdate', onSearchUpdate);
  }, []);
  return [query, setQuery];
}

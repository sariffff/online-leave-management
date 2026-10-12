// app/test-holidays/page.tsx
"use client";

import { useEffect, useState } from 'react';

interface Holiday {
  start: string;
  end: string;
  summary: string;
}

export default function TestHolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const res = await fetch('/api/test?start=2025-01-01&end=2025-12-31');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch');
        setHolidays(data.holidays);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchHolidays();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Thai Holidays Test</h1>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-600">Error: {error}</p>}
      {!loading && !error && (
        <>
          <p className="mb-2">Found {holidays.length} holidays in 2025:</p>
          <pre className="bg-gray-100 p-4 rounded">{JSON.stringify(holidays, null, 2)}</pre>
        </>
      )}
    </div>
  );
}
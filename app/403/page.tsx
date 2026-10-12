'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
export default function Page() {
  return (
    <div>
        <h1 >You don't have permission to enter that website</h1>
        <Link href="/">Go to Home</Link>
    </div>
  );
}
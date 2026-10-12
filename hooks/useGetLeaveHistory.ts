// hooks/useGetLeaveHistory.ts
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface LeaveRequest {
    id: number;
    user_id: string;
    start_date: string;
    end_date: string;
    reason?: string | null;
    status?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    // add any other columns from your `leaverequest` table here
}

export default function useGetLeaveHistory() {
    const [leaveHistory, setLeaveHistory] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchLeaveHistory = async () => {
            setLoading(true);
            setError(null);

            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                setLeaveHistory([]);
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from<LeaveRequest>("leaverequest")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Error fetching leave history:", error.message);
                setError(error.message);
                setLeaveHistory([]);
            } else {
                setLeaveHistory(data ?? []);
            }

            setLoading(false);
        };

        fetchLeaveHistory();
    }, []);

    return { leaveHistory, loading, error };
}
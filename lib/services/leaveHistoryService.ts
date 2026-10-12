// lib/services/leaveHistoryService.ts
import { supabase } from "@/lib/supabaseClient";
import { LeaveHistoryItem,
    LeaveHistorySearchFilters,
    LeaveHistorySummaryData } from "@/components/user/leave-history/type/leave-history";

export interface LeaveHistoryResponse {
  data: LeaveHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class LeaveHistoryService {
  /**
   * ดึงประวัติการลาของผู้ใช้
   */
  static async getLeaveHistory(
    userId: string,
    filters?: LeaveHistorySearchFilters,
    page: number = 1,
    pageSize: number = 10
  ): Promise<LeaveHistoryResponse> {
    try {
      let query = supabase
        .from('leaverequest')
        .select(`
          leave_request_id,
          date_start,
          date_end,
          date_start_type,
          date_end_type,
          total_day,
          reason,
          file,
          timestamp,
          leave_type_id,
          leavetype!inner(
            leave_type_name,
            max_leave_day
          ),
          leaveapproval(
            status,
            comment,
            approved_at,
            approved_by,
            users!leaveapproval_approved_by_fkey(
              prename,
              name,
              surname
            )
          ),
          leavereviewer(
            status,
            reviewed_by,
            approved_by
          )
        `)
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

      // Apply filters
      if (filters?.leaveType) {
        query = query.eq('leavetype.leave_type_name', filters.leaveType);
      }

      if (filters?.status) {
        // Map Thai status to database status
        const statusMap: { [key: string]: string } = {
          'รอพิจารณา': 'pending',
          'อนุมัติ': 'approved',
          'ไม่อนุมัติ': 'rejected'
        };
        const dbStatus = statusMap[filters.status] || filters.status;
        query = query.eq('leaveapproval.status', dbStatus);
      }

      if (filters?.year) {
        const startOfYear = new Date(`${filters.year}-01-01`);
        const endOfYear = new Date(`${filters.year}-12-31`);
        query = query
          .gte('date_start', startOfYear.toISOString().split('T')[0])
          .lte('date_start', endOfYear.toISOString().split('T')[0]);
      }

      // Count total records
      const { count } = await query.select('*', { count: 'exact', head: true });

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      const { data, error } = await query.range(from, to);

      if (error) throw error;

      // Transform data
      const transformedData: LeaveHistoryItem[] = (data || []).map(item => {
        // Get approval info
        const approval = Array.isArray(item.leaveapproval) ? item.leaveapproval[0] : item.leaveapproval;
        const approver = approval?.users;
        
        // Map database status to Thai status
        const statusMap: { [key: string]: string } = {
          'pending': 'รอพิจารณา',
          'approved': 'อนุมัติ',
          'rejected': 'ไม่อนุมัติ'
        };

        const status = approval?.status ? statusMap[approval.status] || approval.status : 'รอพิจารณา';
        
        return {
          id: item.leave_request_id.toString(),
          leaveType: item.leavetype?.leave_type_name || 'ไม่ระบุ',
          startDate: item.date_start,
          endDate: item.date_end,
          totalDays: Number(item.total_day),
          status: status as 'รอพิจารณา' | 'อนุมัติ' | 'ไม่อนุมัติ',
          submittedAt: item.timestamp,
          reason: item.reason,
          approvedBy: approver ? `${approver.prename || ''}${approver.name || ''} ${approver.surname || ''}`.trim() : undefined,
          approvedAt: approval?.approved_at,
          rejectedReason: approval?.status === 'rejected' ? approval.comment : undefined
        };
      });

      return {
        data: transformedData,
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize)
      };

    } catch (error) {
      console.error('Error fetching leave history:', error);
      throw new Error('ไม่สามารถดึงประวัติการลาได้');
    }
  }

  /**
   * ดึงสรุปการใช้สิทธิ์การลา
   */
  static async getLeaveSummary(userId: string, year?: string): Promise<LeaveHistorySummaryData> {
    try {
      // Get user leave quotas
      const { data: quotas, error: quotaError } = await supabase
        .from('userleavequota')
        .select(`
          total_used,
          total_remaining,
          leavetype(
            leave_type_name,
            max_leave_day
          )
        `)
        .eq('user_id', userId);

      if (quotaError) throw quotaError;

      // Initialize summary data
      let sickLeaveUsed = 0;
      let sickLeaveTotal = 0;
      let personalLeaveUsed = 0;
      let personalLeaveTotal = 0;

      // Process quota data
      (quotas || []).forEach(quota => {
        const leaveTypeName = quota.leavetype?.leave_type_name;
        const used = Number(quota.total_used) || 0;
        const maxDays = Number(quota.leavetype?.max_leave_day) || 0;
        
        if (leaveTypeName === 'ลาป่วย') {
          sickLeaveUsed = used;
          sickLeaveTotal = maxDays;
        } else if (leaveTypeName === 'ลากิจ') {
          personalLeaveUsed = used;
          personalLeaveTotal = maxDays;
        }
      });

      // If no quota data found, get from leave types and calculate used days
      if (quotas?.length === 0) {
        // Get default quotas from leave types
        const { data: leaveTypes, error: leaveTypesError } = await supabase
          .from('leavetype')
          .select('leave_type_name, max_leave_day');

        if (!leaveTypesError && leaveTypes) {
          leaveTypes.forEach(type => {
            if (type.leave_type_name === 'ลาป่วย') {
              sickLeaveTotal = type.max_leave_day || 60;
            } else if (type.leave_type_name === 'ลากิจ') {
              personalLeaveTotal = type.max_leave_day || 45;
            }
          });
        }

        // Calculate used days from approved leave requests
        let approvedLeavesQuery = supabase
          .from('leaverequest')
          .select(`
            total_day,
            leavetype(leave_type_name),
            leaveapproval!inner(status)
          `)
          .eq('user_id', userId)
          .eq('leaveapproval.status', 'approved');

        // Filter by year if provided
        if (year) {
          const startOfYear = new Date(`${year}-01-01`);
          const endOfYear = new Date(`${year}-12-31`);
          approvedLeavesQuery = approvedLeavesQuery
            .gte('date_start', startOfYear.toISOString().split('T')[0])
            .lte('date_start', endOfYear.toISOString().split('T')[0]);
        }

        const { data: approvedLeaves } = await approvedLeavesQuery;

        (approvedLeaves || []).forEach(leave => {
          const leaveTypeName = leave.leavetype?.leave_type_name;
          const days = Number(leave.total_day) || 0;

          if (leaveTypeName === 'ลาป่วย') {
            sickLeaveUsed += days;
          } else if (leaveTypeName === 'ลากิจ') {
            personalLeaveUsed += days;
          }
        });
      }

      // Set default totals if still zero
      if (sickLeaveTotal === 0) sickLeaveTotal = 60;
      if (personalLeaveTotal === 0) personalLeaveTotal = 45;

      const totalUsed = sickLeaveUsed + personalLeaveUsed;
      const totalRemaining = (sickLeaveTotal - sickLeaveUsed) + (personalLeaveTotal - personalLeaveUsed);

      return {
        sickLeave: {
          used: sickLeaveUsed,
          total: sickLeaveTotal
        },
        personalLeave: {
          used: personalLeaveUsed,
          total: personalLeaveTotal
        },
        totalUsed,
        totalRemaining
      };

    } catch (error) {
      console.error('Error fetching leave summary:', error);
      throw new Error('ไม่สามารถดึงสรุปการใช้สิทธิ์การลาได้');
    }
  }

  /**
   * ดึงรายละเอียดใบลาตาม ID
   */
  static async getLeaveDetail(leaveId: string): Promise<LeaveHistoryItem> {
    try {
      const { data, error } = await supabase
        .from('leaverequest')
        .select(`
          leave_request_id,
          date_start,
          date_end,
          date_start_type,
          date_end_type,
          total_day,
          reason,
          file,
          status,
          reviewed_by,
          approved_by,
          timestamp,
          leavetype(
            leave_type_name,
            max_leave_day
          )
        
        `)
        .eq('leave_request_id', parseInt(leaveId))
        .single();

      if (error) throw error;
      if (!data) throw new Error('ไม่พบข้อมูลใบลา');

   
      
      // Map database status to Thai status
      const statusMap: { [key: string]: string } = {
        'pending': 'รอพิจารณา',
        'approved': 'อนุมัติ',
        'rejected': 'ไม่อนุมัติ'
      };

      const status = approval?.status ? statusMap[approval.status] || approval.status : 'รอพิจารณา';

      return {
        id: data.leave_request_id.toString(),
        leaveType: data.leavetype?.leave_type_name || 'ไม่ระบุ',
        startDate: data.date_start,
        endDate: data.date_end,
        totalDays: Number(data.total_day),
        status: status as 'รอพิจารณา' | 'อนุมัติ' | 'ไม่อนุมัติ',
        submittedAt: data.timestamp,
        reason: data.reason,
        approvedBy: approver ? `${approver.prename || ''}${approver.name || ''} ${approver.surname || ''}`.trim() : undefined,
        approvedAt: approval?.approved_at,
        rejectedReason: approval?.status === 'rejected' ? approval.comment : undefined
      };

    } catch (error) {
      console.error('Error fetching leave detail:', error);
      throw new Error('ไม่สามารถดึงรายละเอียดใบลาได้');
    }
  }

  /**
   * ยกเลิกใบลา (เฉพาะสถานะ รอพิจารณา)
   */
  static async cancelLeave(leaveId: string): Promise<void> {
    try {
      // ตรวจสอบสถานะก่อน
      const { data: leaveData, error: fetchError } = await supabase
        .from('leaverequest')
        .select(`
          leave_request_id,
          leaveapproval(status)
        `)
        .eq('leave_request_id', parseInt(leaveId))
        .single();

      if (fetchError) throw fetchError;
      if (!leaveData) throw new Error('ไม่พบข้อมูลใบลา');

      const approval = Array.isArray(leaveData.leaveapproval) ? leaveData.leaveapproval[0] : leaveData.leaveapproval;
      
      if (approval?.status && approval.status !== 'pending') {
        throw new Error('ไม่สามารถยกเลิกใบลาที่มีสถานะนี้ได้');
      }

      // อัปเดตสถานะเป็น cancelled หรือลบข้อมูล
      const { error: updateError } = await supabase
        .from('leaveapproval')
        .update({ 
          status: 'cancelled',
          approved_at: new Date().toISOString()
        })
        .eq('leave_request_id', parseInt(leaveId));

      if (updateError) throw updateError;

    } catch (error) {
      console.error('Error canceling leave:', error);
      throw new Error('ไม่สามารถยกเลิกใบลาได้');
    }
  }

  /**
   * ดึงรายการประเภทการลา
   */
  static async getLeaveTypes(): Promise<Array<{ id: number; name: string; maxDays: number }>> {
    try {
      const { data, error } = await supabase
        .from('leavetype')
        .select('leave_type_id, leave_type_name, max_leave_day')
        .order('leave_type_name');

      if (error) throw error;
      console.log('Leave types:', data);
      return (data || []).map(item => ({
        id: item.leave_type_id,
        name: item.leave_type_name,
        maxDays: item.max_leave_day || 0
      }));

    } catch (error) {
      console.error('Error fetching leave types:', error);
      throw new Error('ไม่สามารถดึงประเภทการลาได้');
    }
  }
}
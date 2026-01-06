import prisma from "../lib/prisma";

export class LoggingService {
  /**
   * Log a call to the database
   */
  async logCall(data: {
    tenantId: string;
    customerId?: string;
    phoneNumberId?: string;
    callSid?: string;
    direction: string;
    from: string;
    to: string;
    status: string;
    durationSeconds?: number;
    recordingUrl?: string;
    transcriptSummary?: string;
    sentiment?: string;
    outcome?: string;
    metadata?: any;
    conversationId?: string;
  }) {
    try {
      const callLog = await prisma.callLog.create({
        data: {
          tenantId: data.tenantId,
          customerId: data.customerId,
          phoneNumberId: data.phoneNumberId,
          callSid: data.callSid,
          direction: data.direction,
          from: data.from,
          to: data.to,
          status: data.status,
          durationSeconds: data.durationSeconds || 0,
          recordingUrl: data.recordingUrl,
          transcriptSummary: data.transcriptSummary,
          sentiment: data.sentiment || "NEUTRAL",
          outcome: data.outcome,
          metadata: data.metadata,
          conversationId: data.conversationId,
        },
      });

      console.log(`[LoggingService] Call logged: ${callLog.id}`);
      return { success: true, id: callLog.id };
    } catch (error) {
      console.error("[LoggingService] Failed to log call:", error);
      return { success: false, error };
    }
  }

  /**
   * Log an appointment to the database
   */
  async logAppointment(data: {
    tenantId: string;
    customerId?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    appointmentTime: Date | string;
    durationMinutes: number;
    status?: string;
    eventId?: string;
    source?: string;
    notes?: string;
    metadata?: any;
    conversationId?: string;
  }) {
    try {
      const appointmentLog = await prisma.appointmentLog.create({
        data: {
          tenantId: data.tenantId,
          customerId: data.customerId,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone,
          appointmentTime: new Date(data.appointmentTime),
          durationMinutes: data.durationMinutes,
          status: data.status || "SCHEDULED",
          eventId: data.eventId,
          source: data.source,
          notes: data.notes,
          metadata: data.metadata,
          conversationId: data.conversationId,
        },
      });

      console.log(`[LoggingService] Appointment logged: ${appointmentLog.id}`);
      return { success: true, id: appointmentLog.id };
    } catch (error) {
      console.error("[LoggingService] Failed to log appointment:", error);
      return { success: false, error };
    }
  }

  /**
   * Log feedback to the database
   */
  async logFeedback(data: {
    tenantId: string;
    customerId?: string;
    conversationId?: string;
    rating?: number;
    sentiment?: string;
    category?: string;
    feedback?: string;
    source?: string;
    metadata?: any;
  }) {
    try {
      const feedbackLog = await prisma.feedbackLog.create({
        data: {
          tenantId: data.tenantId,
          customerId: data.customerId,
          conversationId: data.conversationId,
          rating: data.rating,
          sentiment: data.sentiment || "NEUTRAL",
          category: data.category,
          feedback: data.feedback,
          source: data.source,
          metadata: data.metadata,
        },
      });

      console.log(`[LoggingService] Feedback logged: ${feedbackLog.id}`);
      return { success: true, id: feedbackLog.id };
    } catch (error) {
      console.error("[LoggingService] Failed to log feedback:", error);
      return { success: false, error };
    }
  }

  /**
   * Capture a lead
   */
  async captureLead(data: {
    tenantId: string;
    customerId?: string;
    name?: string;
    email?: string;
    phone?: string;
    source?: string;
    status?: string;
    notes?: string;
    metadata?: any;
    conversationId?: string;
    spreadsheetId?: string;
  }) {
    try {
      const leadCapture = await prisma.leadCapture.create({
        data: {
          tenantId: data.tenantId,
          customerId: data.customerId,
          name: data.name,
          email: data.email,
          phone: data.phone,
          source: data.source,
          status: data.status || "NEW",
          notes: data.notes,
          metadata: data.metadata,
          conversationId: data.conversationId,
          spreadsheetId: data.spreadsheetId,
        },
      });

      console.log(`[LoggingService] Lead captured: ${leadCapture.id}`);
      return { success: true, id: leadCapture.id };
    } catch (error) {
      console.error("[LoggingService] Failed to capture lead:", error);
      return { success: false, error };
    }
  }

  /**
   * Update appointment status
   */
  async updateAppointmentStatus(appointmentId: string, status: string) {
    try {
      const updated = await prisma.appointmentLog.update({
        where: { id: appointmentId },
        data: { status },
      });

      console.log(
        `[LoggingService] Appointment status updated: ${appointmentId} -> ${status}`
      );
      return { success: true, appointment: updated };
    } catch (error) {
      console.error(
        "[LoggingService] Failed to update appointment status:",
        error
      );
      return { success: false, error };
    }
  }

  /**
   * Update lead status
   */
  async updateLeadStatus(leadId: string, status: string) {
    try {
      const updated = await prisma.leadCapture.update({
        where: { id: leadId },
        data: { status },
      });

      console.log(
        `[LoggingService] Lead status updated: ${leadId} -> ${status}`
      );
      return { success: true, lead: updated };
    } catch (error) {
      console.error("[LoggingService] Failed to update lead status:", error);
      return { success: false, error };
    }
  }
}

export const loggingService = new LoggingService();

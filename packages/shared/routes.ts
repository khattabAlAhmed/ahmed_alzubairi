import type { z } from "zod";
import {
  adminDeleteParamsSchema,
  adminDeleteRequestSchema,
  contentCreateBodySchemas,
  contentListResponseSchema,
  contentParamsSchema,
  contentUpdateBodySchemas,
  type ContentType,
} from "./content";
import {
  idParamsSchema,
  idResponseSchema,
  okResponseSchema,
  signedUrlResponseSchema,
} from "./fields";
import {
  createProfileRequestSchema,
  createProfileResponseSchema,
} from "./profile";
import {
  consultationDetailResponseSchema,
  consultationListResponseSchema,
  createConsultationRequestSchema,
  createDocumentRequestResponseSchema,
  createDocumentRequestSchema,
  disableAccountRequestSchema,
  disableAccountResponseSchema,
  documentOpenQuerySchema,
  documentOpenResponseSchema,
  notificationCounterSchema,
  readNotificationsRequestSchema,
  sendMessageRequestSchema,
  updateProfileRequestSchema,
} from "./routes-client";
import {
  contactRequestSchema,
  customTrainingRequestSchema,
  newsletterConfirmQuerySchema,
  newsletterSubscribeRequestSchema,
  resourceDownloadRequestSchema,
} from "./routes-public";
import { clientListParamsSchema, teamListParamsSchema } from "./lists";
import {
  clerkUserUpdatedEventSchema,
  cronHourlyResponseSchema,
  posthogConfigResponseSchema,
  resendContactUpdatedEventSchema,
} from "./routes-system";
import {
  adminClientListResponseSchema,
  adminCourseListResponseSchema,
  adminDocumentListResponseSchema,
  adminRoleListResponseSchema,
  adminTeamListResponseSchema,
  approveRequestSchema,
  createCourseSchema,
  createDocumentSchema,
  createMeetingRequestSchema,
  createRoleRequestSchema,
  decideDocumentRequestSchema,
  inviteTeamMemberRequestSchema,
  newsletterExportResponseSchema,
  recommendDocumentRequestSchema,
  updateClientRequestSchema,
  updateConsultationRequestSchema,
  updateCourseSchema,
  updateDocumentSchema,
  updateEmailTemplateRequestSchema,
  updateMeetingRequestSchema,
  updateMessageRequestSchema,
  updateRoleRequestSchema,
  updateTeamMemberRequestSchema,
} from "./routes-team";
import { updateSettingRequestSchema } from "./settings";
import {
  adminUploadFinalizeRequestSchema,
  adminUploadUrlRequestSchema,
  adminUploadUrlResponseSchema,
  attachmentFinalizeRequestSchema,
  attachmentUploadUrlRequestSchema,
  attachmentUploadUrlResponseSchema,
} from "./uploads";

export type RouteContract = {
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
  /** Content routes: the body depends on `:type`. */
  bodyFor?: (type: ContentType) => z.ZodType | undefined;
  /** Content routes: the response depends on `:type`. */
  responseFor?: (type: ContentType) => z.ZodType;
  /** Absent only on a route that answers with a redirect. */
  response?: z.ZodType;
  redirects?: true;
};

/** Every route in project.md §8, with its input and response schemas. */
export const ROUTES = {
  // Public
  "POST /api/contact": {
    body: contactRequestSchema,
    response: okResponseSchema,
  },
  "POST /api/newsletter/subscribe": {
    body: newsletterSubscribeRequestSchema,
    response: okResponseSchema,
  },
  "GET /api/newsletter/confirm": {
    query: newsletterConfirmQuerySchema,
    redirects: true,
  },
  "POST /api/resources/:id/download": {
    params: idParamsSchema,
    body: resourceDownloadRequestSchema,
    response: signedUrlResponseSchema,
  },
  "POST /api/training/custom-requests": {
    body: customTrainingRequestSchema,
    response: okResponseSchema,
  },

  // Client
  "POST /api/profile": {
    body: createProfileRequestSchema,
    response: createProfileResponseSchema,
  },
  "PATCH /api/profile": {
    body: updateProfileRequestSchema,
    response: okResponseSchema,
  },
  "POST /api/account/disable": {
    body: disableAccountRequestSchema,
    response: disableAccountResponseSchema,
  },
  "GET /api/consultations": { response: consultationListResponseSchema },
  "POST /api/consultations": {
    body: createConsultationRequestSchema,
    response: idResponseSchema,
  },
  "GET /api/consultations/:id": {
    params: idParamsSchema,
    response: consultationDetailResponseSchema,
  },
  "POST /api/consultations/:id/messages": {
    params: idParamsSchema,
    body: sendMessageRequestSchema,
    response: idResponseSchema,
  },
  "POST /api/consultations/:id/attachments/upload-url": {
    params: idParamsSchema,
    body: attachmentUploadUrlRequestSchema,
    response: attachmentUploadUrlResponseSchema,
  },
  "POST /api/consultations/:id/attachments/finalize": {
    params: idParamsSchema,
    body: attachmentFinalizeRequestSchema,
    response: okResponseSchema,
  },
  "GET /api/attachments/:id": {
    params: idParamsSchema,
    response: signedUrlResponseSchema,
  },
  "POST /api/document-requests": {
    body: createDocumentRequestSchema,
    response: createDocumentRequestResponseSchema,
  },
  "GET /api/documents/:id/open": {
    params: idParamsSchema,
    query: documentOpenQuerySchema,
    response: documentOpenResponseSchema,
  },
  "POST /api/courses/:id/register": {
    params: idParamsSchema,
    response: okResponseSchema,
  },
  "POST /api/notifications/read": {
    body: readNotificationsRequestSchema,
    response: notificationCounterSchema,
  },

  // Team
  "PATCH /api/admin/consultations/:id": {
    params: idParamsSchema,
    body: updateConsultationRequestSchema,
    response: okResponseSchema,
  },
  "POST /api/admin/consultations/:id/meetings": {
    params: idParamsSchema,
    body: createMeetingRequestSchema,
    response: idResponseSchema,
  },
  "PATCH /api/admin/consultations/:id/meetings": {
    params: idParamsSchema,
    body: updateMeetingRequestSchema,
    response: okResponseSchema,
  },
  "GET /api/admin/content/:type": {
    params: contentParamsSchema,
    responseFor: contentListResponseSchema,
  },
  "POST /api/admin/content/:type": {
    params: contentParamsSchema,
    bodyFor: (type) =>
      type === "home_sections" ? undefined : contentCreateBodySchemas[type],
    response: idResponseSchema,
  },
  "PATCH /api/admin/content/:type": {
    params: contentParamsSchema,
    bodyFor: (type) => contentUpdateBodySchemas[type],
    response: okResponseSchema,
  },
  "PATCH /api/admin/testimonials/:id/approve": {
    params: idParamsSchema,
    body: approveRequestSchema,
    response: okResponseSchema,
  },
  "PATCH /api/admin/partners/:id/approve": {
    params: idParamsSchema,
    body: approveRequestSchema,
    response: okResponseSchema,
  },
  "POST /api/admin/document-requests/:id/recommend": {
    params: idParamsSchema,
    body: recommendDocumentRequestSchema,
    response: okResponseSchema,
  },
  "POST /api/admin/document-requests/:id/decide": {
    params: idParamsSchema,
    body: decideDocumentRequestSchema,
    response: okResponseSchema,
  },
  "GET /api/admin/documents": { response: adminDocumentListResponseSchema },
  "POST /api/admin/documents": {
    body: createDocumentSchema,
    response: idResponseSchema,
  },
  "PATCH /api/admin/documents": {
    body: updateDocumentSchema,
    response: okResponseSchema,
  },
  "POST /api/admin/uploads/upload-url": {
    body: adminUploadUrlRequestSchema,
    response: adminUploadUrlResponseSchema,
  },
  "POST /api/admin/uploads/finalize": {
    body: adminUploadFinalizeRequestSchema,
    response: okResponseSchema,
  },
  "GET /api/admin/courses": { response: adminCourseListResponseSchema },
  "POST /api/admin/courses": {
    body: createCourseSchema,
    response: idResponseSchema,
  },
  "PATCH /api/admin/courses": {
    body: updateCourseSchema,
    response: okResponseSchema,
  },
  "GET /api/admin/clients": {
    query: clientListParamsSchema,
    response: adminClientListResponseSchema,
  },
  "PATCH /api/admin/clients": {
    body: updateClientRequestSchema,
    response: okResponseSchema,
  },
  "GET /api/admin/team": {
    query: teamListParamsSchema,
    response: adminTeamListResponseSchema,
  },
  "POST /api/admin/team": {
    body: inviteTeamMemberRequestSchema,
    response: okResponseSchema,
  },
  "PATCH /api/admin/team": {
    body: updateTeamMemberRequestSchema,
    response: okResponseSchema,
  },
  "GET /api/admin/roles": { response: adminRoleListResponseSchema },
  "POST /api/admin/roles": {
    body: createRoleRequestSchema,
    response: idResponseSchema,
  },
  "PATCH /api/admin/roles": {
    body: updateRoleRequestSchema,
    response: okResponseSchema,
  },
  "PATCH /api/admin/settings": {
    body: updateSettingRequestSchema,
    response: okResponseSchema,
  },
  "PATCH /api/admin/email-templates": {
    body: updateEmailTemplateRequestSchema,
    response: okResponseSchema,
  },
  "PATCH /api/admin/messages": {
    body: updateMessageRequestSchema,
    response: okResponseSchema,
  },
  "GET /api/admin/newsletter/export": {
    response: newsletterExportResponseSchema,
  },
  "DELETE /api/admin/:type/:id": {
    params: adminDeleteParamsSchema,
    body: adminDeleteRequestSchema,
    response: okResponseSchema,
  },

  // System
  "POST /api/clerk/webhook": {
    body: clerkUserUpdatedEventSchema,
    response: okResponseSchema,
  },
  "POST /api/resend/webhook": {
    body: resendContactUpdatedEventSchema,
    response: okResponseSchema,
  },
  "POST /api/cron/hourly": { response: cronHourlyResponseSchema },
  "GET /api/posthog-config": { response: posthogConfigResponseSchema },
} as const satisfies Record<string, RouteContract>;

export type RouteName = keyof typeof ROUTES;


import { getSupabasePublicConfig } from "@/lib/server/auth-config";
import type { AssistantTurn, SystemNotification } from "./domain";
import {
  assistantCommunicationPayloadSchema,
  assistantTurnSchema,
  systemCommunicationPayloadSchema,
  systemNotificationSchema,
} from "./output-contracts";
import { COMMUNICATION_ADMIN_RPC } from "./rpc-contract";
import { CommunicationRepositoryError } from "./repository";

type JsonObject = Record<string, unknown>;

type AdminRepositoryOptions = {
  fetcher?: typeof fetch;
};

function serviceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new CommunicationRepositoryError(
      "communication_admin_not_configured",
      503,
    );
  }
  return key;
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function createCommunicationAdminRepository(
  options: AdminRepositoryOptions = {},
) {
  const fetcher = options.fetcher ?? fetch;

  async function rpc(name: string, args: JsonObject) {
    const { url } = getSupabasePublicConfig();
    const key = serviceRoleKey();
    let response: Response;
    try {
      response = await fetcher(
        `${url.replace(/\/+$/, "")}/rest/v1/rpc/${name}`,
        {
          method: "POST",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(args),
          cache: "no-store",
        },
      );
    } catch {
      throw new CommunicationRepositoryError(
        "communication_admin_network_error",
        503,
      );
    }
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const details = isObject(payload) ? payload : {};
      throw new CommunicationRepositoryError(
        typeof details.message === "string"
          ? details.message
          : `communication_admin_rpc_failed_${response.status}`,
        response.status,
        typeof details.code === "string" ? details.code : null,
      );
    }
    return payload;
  }

  return {
    async appendAssistantTurn(input: {
      ownerAccountId: string;
      conversationId: string;
      body: string;
      payload: Record<string, unknown>;
      deliveryKind: "interactive" | "background_result" | "insight";
      sourceKey: string | null;
    }): Promise<AssistantTurn> {
      const safePayload = assistantCommunicationPayloadSchema.parse(
        input.payload,
      );
      const payload = await rpc(COMMUNICATION_ADMIN_RPC.appendAssistantTurn, {
        p_owner_account_id: input.ownerAccountId,
        p_conversation_id: input.conversationId,
        p_body: input.body,
        p_payload: safePayload,
        p_delivery_kind: input.deliveryKind,
        p_source_key: input.sourceKey,
      });
      const parsed = assistantTurnSchema.safeParse(payload);
      if (!parsed.success) {
        throw new CommunicationRepositoryError(
          "communication_rpc_output_invalid:append_assistant_turn_admin",
          502,
          "communication_rpc_output_invalid",
        );
      }
      return parsed.data;
    },

    async appendSystemNotification(input: {
      recipientAccountId: string;
      eventType: string;
      severity: SystemNotification["severity"];
      title: string;
      body: string;
      payload: Record<string, unknown>;
      dedupeKey: string;
      occurredAt?: string;
    }): Promise<SystemNotification> {
      const safePayload = systemCommunicationPayloadSchema.parse(input.payload);
      const payload = await rpc(
        COMMUNICATION_ADMIN_RPC.appendSystemNotification,
        {
          p_recipient_account_id: input.recipientAccountId,
          p_event_type: input.eventType,
          p_severity: input.severity,
          p_title: input.title,
          p_body: input.body,
          p_payload: safePayload,
          p_dedupe_key: input.dedupeKey,
          p_occurred_at: input.occurredAt ?? new Date().toISOString(),
        },
      );
      const parsed = systemNotificationSchema.safeParse(payload);
      if (!parsed.success) {
        throw new CommunicationRepositoryError(
          "communication_rpc_output_invalid:append_system_notification_admin",
          502,
          "communication_rpc_output_invalid",
        );
      }
      return parsed.data;
    },
  };
}

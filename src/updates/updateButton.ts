import type { MessageKey } from "../i18n/messages";
import type { PluginUpdateStatus } from "./updateTypes";

export interface UpdateButtonState {
  disabled: boolean;
  labelKey: MessageKey;
  titleKey: MessageKey;
}

export function getUpdateButtonState(status: PluginUpdateStatus): UpdateButtonState {
  switch (status.kind) {
    case "available":
      return {
        disabled: false,
        labelKey: "update",
        titleKey: "updateAvailableDesc",
      };
    case "checking":
      return {
        disabled: true,
        labelKey: "checkingUpdates",
        titleKey: "checkingUpdatesDesc",
      };
    case "current":
      return {
        disabled: true,
        labelKey: "upToDate",
        titleKey: "upToDateDesc",
      };
    case "failed":
      return {
        disabled: true,
        labelKey: "updateCheckFailed",
        titleKey: "updateCheckFailedDesc",
      };
    default:
      return {
        disabled: true,
        labelKey: "updateUnknown",
        titleKey: "updateUnknownDesc",
      };
  }
}

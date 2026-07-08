import { ErrorCode, type ErrorCodeType } from "./error-codes";

type TranslateFn = (key: string) => string;

const ERROR_CODE_TO_KEY: Record<ErrorCodeType, string> = {
  [ErrorCode.PROMPT_REQUIRED]: "promptRequired",
  [ErrorCode.INSUFFICIENT_CREDITS]: "insufficientCredits",
  [ErrorCode.UNAUTHORIZED]: "unauthorized",
  [ErrorCode.INVALID_PACKAGE]: "invalidPackage",
  [ErrorCode.TASK_NOT_FOUND]: "taskNotFound",
  [ErrorCode.FAILED_TO_CREATE_ORDER]: "failedToCreateOrder",
  [ErrorCode.FAILED_TO_CREATE_GENERATION]: "failedToCreateGeneration",
  [ErrorCode.FAILED_TO_DELETE_TASK]: "failedToDeleteTask",
  [ErrorCode.CANNOT_DELETE_TASK]: "cannotDeleteTask",
  [ErrorCode.INVALID_REFERENCE_IMAGE]: "invalidReferenceImage",
  [ErrorCode.INTERNAL_ERROR]: "internalError",
  [ErrorCode.UNKNOWN]: "unknown",
};

const LEGACY_ERROR_MAP: Record<string, ErrorCodeType> = {
  "Prompt is required": ErrorCode.PROMPT_REQUIRED,
  "Insufficient credits": ErrorCode.INSUFFICIENT_CREDITS,
  Unauthorized: ErrorCode.UNAUTHORIZED,
  "Invalid package ID": ErrorCode.INVALID_PACKAGE,
  "Task not found": ErrorCode.TASK_NOT_FOUND,
  "Failed to create order": ErrorCode.FAILED_TO_CREATE_ORDER,
  "Cannot delete task in current status": ErrorCode.CANNOT_DELETE_TASK,
  "Reference image must use your uploaded or generated images":
    ErrorCode.INVALID_REFERENCE_IMAGE,
};

export function resolveErrorCode(
  errorCode?: string | null,
  errorMessage?: string | null,
): ErrorCodeType {
  if (errorCode && errorCode in ERROR_CODE_TO_KEY) {
    return errorCode as ErrorCodeType;
  }
  if (errorMessage && errorMessage in LEGACY_ERROR_MAP) {
    return LEGACY_ERROR_MAP[errorMessage];
  }
  return ErrorCode.UNKNOWN;
}

export function translateError(
  t: TranslateFn,
  errorCode?: string | null,
  errorMessage?: string | null,
): string {
  const code = resolveErrorCode(errorCode, errorMessage);
  const key = ERROR_CODE_TO_KEY[code];
  const translated = t(key);
  if (code === ErrorCode.UNKNOWN && errorMessage) {
    return errorMessage;
  }
  return translated;
}

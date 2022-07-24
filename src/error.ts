import * as vscode from 'vscode';

/** Error indicating formatting failure. */
export class FormatError extends Error {}

/** Handle error thrown from `tidy` function */
export function handleTidyError (error: unknown) {
  if (error instanceof FormatError) {
    vscode.window.showErrorMessage(error.message);
  } else {
    vscode.window.showErrorMessage(`Internal error: ${error}`);
  }
}

/** Whether the error is compatible with `NodeJS.ErrnoException` or not. */
export function isErrnoException (e: unknown): e is NodeJS.ErrnoException {
  return e instanceof Error;
}

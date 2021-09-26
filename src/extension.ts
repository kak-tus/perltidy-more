'use strict';

import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { dirname, join, isAbsolute } from 'path';
import { existsSync } from 'fs';
import { FormatError, handleTidyError } from './error';

export function activate(context: vscode.ExtensionContext) {
  const selector = ['perl', 'perl+mojolicious'];
  function get_range(document: vscode.TextDocument, range: vscode.Range | null, selection: vscode.Selection | null) {
    if (!(selection === null) && !selection.isEmpty) {
      range = new vscode.Range(selection.start, selection.end);
    }

    if (range === null) {
      let start = new vscode.Position(0, 0);
      let end = new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length);
      range = new vscode.Range(start, end);
    }

    return range;
  }

  /**
   * format text by perltidy.
   * @param document Documents containing text 
   * @param range Range of text
   * @returns Returns the formatted text.
   * @throws {import('./error').FormatError} Throw an error if failed to format.
   * @throws {unknown} Throw an error an unexpected problem has occurred.
   */
  function tidy(document: vscode.TextDocument, range: vscode.Range): Promise<string> {
    let text = document.getText(range);
    if (!text || text.length === 0) return new Promise((resolve) => { resolve('') });

    let config = vscode.workspace.getConfiguration('perltidy-more');

    var executable = config.get('executable', '');
    let profile = config.get('profile', '');

    const currentWorkspace = vscode.workspace.getWorkspaceFolder(
      document.uri
    )

    if (currentWorkspace === undefined) {
      throw new FormatError('Format failed. File must be belong to one workspace at least.');
    }

    if (config.get('autoDisable', false)) {
      if (!existsSync(join(currentWorkspace.uri.path, '.perltidyrc'))) {
        throw new FormatError('Format failed. `.perltidyrc` not found.');
      }
    }

    let args: string[] = [
      "--standard-output",
      // Terminal newline causes a problem when formatting selection.
      // We cannot determine whether the terminal newline is from original code, or appended by perltidy.
      // With terminal newline: "foo\n" -> "foo\n", "foo" -> "foo\n"
      // Expected result:       "foo\n" -> "foo\n", "foo" -> "foo"
      "-no-add-terminal-newline",
    ];

    if (profile) {
      args.push("--profile=" + profile);
    }

    let options = {
      cwd: dirname(document.uri.fsPath)
    };

    // Support for spawn at virtual filesystems
    if (document.uri.scheme != "file") {
      options.cwd = ".";
    }

    // Support for executing relative path script from the current workspace. eg: ./script/perltidy-wrapper.pl
    if (!isAbsolute(executable)) {
      let resolved = join(currentWorkspace.uri.path, executable)

      if (existsSync(resolved)) {
        executable = resolved;

        // Also we change cwd to support for local .perltidyrc in case of run it
        // in docker image (may be cwd will be set to workspace folder for all
        // cases)
        options.cwd = currentWorkspace.uri.path;
      }
    }

    return new Promise((resolve, reject) => {
      try {
        let worker = spawn(executable, args, options);

        worker.stdin.write(text);
        worker.stdin.end();

        let result_text = '';

        worker.stdout.on('data', (chunk) => {
          result_text += chunk;
        });
        worker.stdout.on('end', () => {
          resolve(result_text);
        });
      }
      catch (error) {
        // internal error
        reject(error);
      }
    });
  }

  let provider = vscode.languages.registerDocumentRangeFormattingEditProvider(selector, {
    provideDocumentRangeFormattingEdits: (document, range, options, token) => {
      // To keep indent level, expand the range to include the beginning of the line.
      // "  [do {]" -> "[  do {]"
      //
      // Don't expand if there is a non-whitespace character between the beginning of the line and the range
      // "return [do {]" -> "return [do {]"
      const indentRange = new vscode.Range(new vscode.Position(range.start.line, 0), range.start);
      if (document.getText(indentRange).match(/^\s*$/)) {
        range = new vscode.Range(new vscode.Position(range.start.line, 0), range.end);
      }

      return new Promise((resolve, reject) => {
        range = get_range(document, range, null);

        let promise = tidy(document, range);
        if (!promise) {
          return;
        }

        promise.then((res: string) => {
          let result: vscode.TextEdit[] = [];
          result.push(new vscode.TextEdit(range, res));
          resolve(result);
        }).catch(handleTidyError);
      });
    }
  });

  let formatOnTypeProvider = vscode.languages.registerOnTypeFormattingEditProvider(selector, {
    provideOnTypeFormattingEdits: (document, position, ch, options, token) => {
      return new Promise((resolve, reject) => {
        // Determine start position. start format from the next line of the previous ';'.
        let start = new vscode.Position(0, 0);
        let lineNumber = position.line - 1;
        while (lineNumber >= 0) {
          const line = document.lineAt(lineNumber);
          const indexOfSemicolon = line.text.lastIndexOf(';');
          if (indexOfSemicolon >= 0) {
            start = new vscode.Position(lineNumber + 1, 0);
            break;
          }
          lineNumber--;
        }
        const range = new vscode.Range(start, position);

        const promise = tidy(document, range);
        if (!promise) {
          return;
        }

        promise.then((res: string) => {
          if (token.isCancellationRequested) {
            return;
          }
          const result: vscode.TextEdit[] = [];
          result.push(new vscode.TextEdit(range, res));
          resolve(result);
        }).catch(handleTidyError);
      });
    }
  }, ';', '}', ')', ']');

  let command = vscode.commands.registerCommand('perltidy-more.tidy', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    let document = editor.document;
    let selection = editor.selection;

    let range = get_range(document, null, selection);

    let promise = tidy(document, range);
    if (!promise) {
      return;
    }

    promise.then((res: string) => {
      editor.edit((builder: vscode.TextEditorEdit) => {
        builder.replace(range, res);
      });
    }).catch(handleTidyError);
  });

  context.subscriptions.push(provider);
  context.subscriptions.push(formatOnTypeProvider);
  context.subscriptions.push(command);
}

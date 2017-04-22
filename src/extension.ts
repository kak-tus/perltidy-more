'use strict';

import * as vscode from 'vscode';
import { spawn } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
  let provider = vscode.languages.registerDocumentRangeFormattingEditProvider('perl', {
    provideDocumentRangeFormattingEdits: (document, range, options, token) => {
      if (range === null) {
        let start = new vscode.Position(0, 0);
        let end = new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length);
        range = new vscode.Range(start, end);
      }

      let text = document.getText(range);
      if (!text || text.length === 0) return;

      let result: vscode.TextEdit[] = [];

      let config = vscode.workspace.getConfiguration('perltidy-more');

      let executable = config.get('executable', '');
      let profile = config.get('profile', '');

      let args: string[] = ["-st"];

      if (profile) {
        args.push("--profile=" + profile);
      }

      return new Promise((resolve, reject) => {
        try {
          let worker = spawn(executable, args);

          worker.stdin.write(text);
          worker.stdin.end();

          let result_text = '';

          worker.stdout.on('data', (chunk) => {
            result_text += chunk;
          });
          worker.stdout.on('end', () => {
            result.push(new vscode.TextEdit(range, result_text));
            resolve(result);
          });
        }
        catch (error) {
          reject(error);
        }
      });

    }
  });

  context.subscriptions.push(provider);
}

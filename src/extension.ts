'use strict';

import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { dirname } from 'path';

export function activate(context: vscode.ExtensionContext) {
  function get_range(document: vscode.TextDocument, range: vscode.Range, selection: vscode.Selection) {
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

  function tidy(document: vscode.TextDocument, range: vscode.Range) {
    let text = document.getText(range);
    if (!text || text.length === 0) return;

    let config = vscode.workspace.getConfiguration('perltidy-more');

    let executable = config.get('executable', '');
    let profile = config.get('profile', '');

    let args: string[] = ["-st"];

    if (profile) {
      args.push("--profile=" + profile);
    }

    let options = {
      cwd: dirname(document.uri.fsPath)
    };

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
          result_text.trim();
          resolve(result_text);
        });
      }
      catch (error) {
        reject(error);
      }
    });
  }

  let provider = vscode.languages.registerDocumentRangeFormattingEditProvider(['perl', 'perl+mojolicious'], {
    provideDocumentRangeFormattingEdits: (document, range, options, token) => {
      return new Promise((resolve, reject) => {
        range = get_range(document, range, null);

        let promise = tidy(document, range);
        if (!promise) {
          reject();
          return;
        }

        promise.then((res: string) => {
          let result: vscode.TextEdit[] = [];
          result.push(new vscode.TextEdit(range, res));
          resolve(result);
        });
      });
    }
  });

  let command = vscode.commands.registerCommand('perltidy-more.tidy', () => {
    let editor = vscode.window.activeTextEditor;
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
    });
  });

  context.subscriptions.push(provider);
  context.subscriptions.push(command);
}

const vscode = require('vscode');
const fs = require('fs');
const yaml = require('yaml');

let dependencies;
let existingImports = [];

function parsePubspec() {
  const rootPath = vscode.workspace.workspaceFolders;
  if (!rootPath || rootPath.length === 0) {
    vscode.window.showErrorMessage(
      'No workspace found. Please open a workspace containing the pubspec.yaml file.'
    );
    return;
  }

  const pubspecPath = vscode.Uri.joinPath(
    rootPath[0].uri,
    'pubspec.yaml'
  ).fsPath;

  fs.readFile(pubspecPath, 'utf8', (err, data) => {
    if (err) {
      vscode.window.showErrorMessage(
        `Error reading pubspec.yaml file: ${err.message}`
      );
      return;
    }

    try {
      const pubspec = yaml.parse(data);
      dependencies = pubspec.dependencies;
      vscode.window.showInformationMessage(
        'Pubspec.yaml file parsed successfully.'
      );
      organizeImports();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error parsing pubspec.yaml file: ${error.message}`
      );
    }
  });
}

function generateImportStatements(document) {
  if (!dependencies) {
    vscode.window.showErrorMessage(
      'No dependencies found. Please ensure the pubspec.yaml file is parsed successfully.'
    );
    return null;
  }

  const importStatements = Object.keys(dependencies).map((packageName) => {
    if (packageName === 'flutter') {
      return null; // Skip importing the invalid 'flutter' package
    }

    const importStatement = `import 'package:${packageName}/${packageName}.dart';`;
    if (existingImports.includes(importStatement)) {
      return null; // Skip if import statement already exists
    }

    return importStatement;
  });

  const hasFlutterWidget =
    document.getText().includes('StatefulWidget') ||
    document.getText().includes('StatelessWidget');
  if (
    hasFlutterWidget &&
    !existingImports.includes(`import 'package:flutter/material.dart';`)
  ) {
    importStatements.push(`import 'package:flutter/material.dart';`); // Add flutter/material.dart import if not already present
  }
  const hasWidgetsFlutterBinding = document
    .getText()
    .includes('WidgetsFlutterBinding');
  if (hasWidgetsFlutterBinding) {
    importStatements.push(`import 'firebase_options.dart';`);
  }

  return importStatements.filter((statement) => statement !== null).join('\n'); // Return the import statements
}

function organizeImports() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const document = editor.document;

  const importBlock = generateImportStatements(document);
  if (!importBlock) {
    return;
  }

  const imports = document
    .getText()
    .split('\n')
    .filter((line) => line.trim().startsWith('import'))
    .sort();

  existingImports = imports; // Update existing imports

  const filteredImports = imports.filter(
    (importLine) => !existingImports.includes(importLine)
  );
  const uniqueImports = [...new Set(filteredImports)];

  const updatedImportBlock = importBlock + '\n' + uniqueImports.join('\n');

  const edit = new vscode.WorkspaceEdit();
  const importRange = new vscode.Range(
    new vscode.Position(0, 0),
    new vscode.Position(0, 0)
  );

  edit.replace(document.uri, importRange, updatedImportBlock + '\n\n');

  vscode.workspace.applyEdit(edit).then(() => {
    vscode.commands.executeCommand('editor.action.organizeImports');
  });
}

function activate(context) {
  console.log('Congratulations, your extension "hmseeb" is now active!');

  let disposable = vscode.commands.registerCommand(
    'hmseeb.FlutterImport',
    function () {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const document = editor.document;
      existingImports = document
        .getText()
        .split('\n')
        .filter((line) => line.trim().startsWith('import'));

      parsePubspec();
      organizeImports(); // Call organizeImports after existingImports is initialized
    }
  );

  parsePubspec();
  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};

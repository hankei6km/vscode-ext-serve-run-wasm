import * as assert from 'assert'
//import { before } from 'mocha'

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode'
// import * as myExtension from '../extension';

suite('environment vriables in teminal', () => {
  vscode.window.showInformationMessage('Start all tests.')

  // suite('environment variables', async () => { // これは動かない(テストの対象にならない)
  test('environment variables', async () => {
    // capture new text document is opened.
    const documentOpenedPromise = new Promise<vscode.TextDocument>(
      (resolve) => {
        const disposable = vscode.workspace.onDidOpenTextDocument(
          (document) => {
            resolve(document)
            disposable.dispose()
          }
        )
      }
    )
    // wait new terminal is opened
    const terminalOpenedPromise = new Promise<vscode.Terminal | undefined>(
      (resolve) => {
        const disposable = vscode.window.onDidChangeActiveTerminal(
          (terminal) => {
            if (terminal === undefined) return
            resolve(terminal)
            disposable.dispose()
          }
        )
      }
    )

    // open terminal
    await vscode.commands.executeCommand('workbench.action.terminal.new')
    const terminal = await terminalOpenedPromise
    // 安定するまで待つ(タイミングによってはテストが失敗する)
    // TODO: 正しい待ち方を調べる
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // execute "terminal.showEnvironmentContributions"
    await vscode.commands.executeCommand(
      'workbench.action.terminal.showEnvironmentContributions'
    )

    // get the text of the opened document
    const document = await documentOpenedPromise
    const envText = document.getText()

    // wait terminal is closed
    const terminalClosedPromise = new Promise<vscode.Terminal | undefined>(
      (resolve) => {
        const disposable = vscode.window.onDidCloseTerminal((terminal) => {
          resolve(terminal)
          disposable.dispose()
        })
      }
    )
    // close terminal.
    //await vscode.commands.executeCommand('workbench.action.terminal.kill')
    if (terminal === undefined) return
    terminal.sendText('exit')
    await terminalClosedPromise

    assert.match(envText, /`VSCODE_EXT_SERVE_RUN_WASM_IPC_PATH=/)
  })
})

suite('http servr for run wasm', () => {
  test('run wasm via http server', async () => {
    // wait new terminal is opened
    const terminalOpenedPromise = new Promise<vscode.Terminal | undefined>(
      (resolve) => {
        const disposable = vscode.window.onDidChangeActiveTerminal(
          (terminal) => {
            if (terminal === undefined) return
            resolve(terminal)
            disposable.dispose()
          }
        )
      }
    )

    // open terminal
    await vscode.commands.executeCommand('workbench.action.terminal.new')
    const terminal = await terminalOpenedPromise
    // 安定するまで待つ(タイミングによってはテストが失敗する)
    // TODO: 正しい待ち方を調べる
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // wait terminal is closed
    const terminalClosedPromise = new Promise<vscode.Terminal | undefined>(
      (resolve) => {
        const disposable = vscode.window.onDidCloseTerminal((terminal) => {
          resolve(terminal)
          disposable.dispose()
        })
      }
    )

    // input "curl --unix-socket "${VSCODE_EXT_SERVE_RUN_WASM_IPC_PATH}"  http://localhost/ > test_out/run_out.txt && exit" to terminal
    if (terminal === undefined) return

    const clientBin = '../target/release/crw'
    const wasmFile = 'wasm/bin/chk1.wasm'

    terminal.sendText(
      `echo "" | ${clientBin} run ${wasmFile} echo test 123` +
        ' > test_out/run_out.txt'
    )

    terminal.sendText(
      `echo "" | ${clientBin} run ${wasmFile} err TEST 456` +
        ' 2> test_out/run_err.txt'
    )

    terminal.sendText(
      `seq 10000 | ${clientBin} run ${wasmFile} --force-exit-after-n-seconds-stdin-is-closed 5 pipe` +
        ' | sha256sum> test_out/run_pipe.txt'
    )

    terminal.sendText(
      `echo "" | ${clientBin} run ${wasmFile} exit 123` +
        '; echo "${?}" > test_out/run_status.txt'
    )

    terminal.sendText(
      `echo "" | ${clientBin} run ${wasmFile} seq 10000` +
        ' | sha256sum > test_out/run_seq.txt'
    )

    terminal.sendText(
      `echo "" | ${clientBin} run foo.wasm` + ' 2> test_out/run_noent.txt'
    )

    terminal.sendText('exit')

    // wait terminal is closed
    await terminalClosedPromise

    // read test_out/run_out.txt and check the content
    {
      const filename = vscode.Uri.joinPath(
        vscode.workspace.workspaceFolders![0].uri,
        'test_out',
        'run_out.txt'
      )
      assert.deepEqual(
        (await vscode.workspace.fs.readFile(filename)).toString(),
        'test 123 \n',
        'run_out.txt'
      )
    }
    {
      const filename = vscode.Uri.joinPath(
        vscode.workspace.workspaceFolders![0].uri,
        'test_out',
        'run_err.txt'
      )
      assert.deepEqual(
        (await vscode.workspace.fs.readFile(filename)).toString(),
        'TEST 456 \n',
        'run_err.txt'
      )
    }
    {
      const filename = vscode.Uri.joinPath(
        vscode.workspace.workspaceFolders![0].uri,
        'test_out',
        'run_pipe.txt'
      )
      assert.deepEqual(
        (await vscode.workspace.fs.readFile(filename)).toString(),
        '8060aa0ac20a3e5db2b67325c98a0122f2d09a612574458225dcb9a086f87cc3  -\n',
        'run_pipe.txt'
      )
    }
    {
      const filename = vscode.Uri.joinPath(
        vscode.workspace.workspaceFolders![0].uri,
        'test_out',
        'run_status.txt'
      )
      assert.deepEqual(
        (await vscode.workspace.fs.readFile(filename)).toString(),
        '123\n',
        'run_status.txt'
      )
    }
    {
      const filename = vscode.Uri.joinPath(
        vscode.workspace.workspaceFolders![0].uri,
        'test_out',
        'run_seq.txt'
      )
      assert.deepEqual(
        (await vscode.workspace.fs.readFile(filename)).toString(),
        // seq 4000 | sha256sum
        '8060aa0ac20a3e5db2b67325c98a0122f2d09a612574458225dcb9a086f87cc3  -\n',
        'run_seq.txt'
      )
    }
    {
      const filename = vscode.Uri.joinPath(
        vscode.workspace.workspaceFolders![0].uri,
        'test_out',
        'run_noent.txt'
      )
      assert.match(
        (await vscode.workspace.fs.readFile(filename)).toString(),
        /run: EntryNotFound \(FileSystemError\): Error: ENOENT: no such file or directory, open '.+\/foo\.wasm'\n/,
        'run_noent.txt'
      )
    }
  })
})
